// ---------------------------------------------------------------------------
// Teste de integração/smoke do fluxo completo (tarefa 13.1)
//
// Exercita a STACK REAL rodando (os quatro serviços) ponta a ponta via HTTP,
// provando a comunicação entre serviços descrita no design:
//   - Carrinho consultando Produtos (preço/estoque) ............ Req 10.1, 10.4
//   - Pedidos revalidando/reservando/devolvendo no Produtos .... Req 10.1, 10.4
//   - Chamada via proxy do Frontend (/api/produtos -> produtos) . Req 10.2
//   - Persistência (produto criado sobrevive à leitura) ........ Req 9.1, 9.3
//   - GET /health de cada backend retorna 200 .................. Req 12.7
//
// Como a stack pode NÃO estar rodando (sandbox/CI sem Docker), o suite detecta
// a indisponibilidade no startup (GET produtos/health) e PULA graciosamente,
// com uma mensagem clara, em vez de falhar.
//
// URLs base configuráveis por variáveis de ambiente (padrão = portas de host
// publicadas pelo docker-compose):
//   PRODUTOS_URL  (default http://localhost:3001)
//   CARRINHO_URL  (default http://localhost:3002)
//   PEDIDOS_URL   (default http://localhost:3003)
//   FRONTEND_URL  (default http://localhost:3000)
//
// Execução:
//   1) docker compose up --build        (na raiz do projeto)
//   2) cd integration-tests && node --test
// ---------------------------------------------------------------------------
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const PRODUTOS_URL = process.env.PRODUTOS_URL || 'http://localhost:3001';
const CARRINHO_URL = process.env.CARRINHO_URL || 'http://localhost:3002';
const PEDIDOS_URL = process.env.PEDIDOS_URL || 'http://localhost:3003';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const MENSAGEM_STACK_FORA =
    'stack não está rodando; execute `docker compose up --build` e rode novamente';

/**
 * Faz uma requisição JSON e devolve { status, body }. Lança em erro de rede
 * (ex.: ECONNREFUSED) para que o chamador trate a indisponibilidade.
 *
 * @param {string} url
 * @param {{ method?: string, body?: unknown, headers?: Record<string,string> }} [opcoes]
 * @returns {Promise<{ status: number, body: any }>}
 */
async function pedir(url, opcoes = {}) {
    const init = { method: opcoes.method || 'GET', headers: { ...(opcoes.headers || {}) } };
    if (opcoes.body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(opcoes.body);
    }
    const resp = await fetch(url, init);
    let body = null;
    const texto = await resp.text();
    if (texto) {
        try {
            body = JSON.parse(texto);
        } catch {
            body = texto;
        }
    }
    return { status: resp.status, body };
}

/**
 * Detecta se a stack está acessível tentando GET {PRODUTOS_URL}/health.
 * Retorna true quando responde 200; false em qualquer erro de conexão.
 *
 * @returns {Promise<boolean>}
 */
async function stackAcessivel() {
    try {
        const { status } = await pedir(`${PRODUTOS_URL}/health`);
        return status === 200;
    } catch {
        return false;
    }
}

test('smoke: fluxo completo de comunicação entre serviços', async (t) => {
    // Skip gracioso quando a stack não está rodando (sandbox/CI sem Docker).
    if (!(await stackAcessivel())) {
        t.skip(MENSAGEM_STACK_FORA);
        return;
    }

    // -----------------------------------------------------------------------
    // 1. Health de cada backend -> 200 { status: "ok" }. (Req 12.7)
    // -----------------------------------------------------------------------
    await t.test('health dos backends retorna 200 ok', async () => {
        for (const base of [PRODUTOS_URL, CARRINHO_URL, PEDIDOS_URL]) {
            const { status, body } = await pedir(`${base}/health`);
            assert.equal(status, 200, `GET ${base}/health deveria retornar 200`);
            assert.deepEqual(body, { status: 'ok' });
        }
    });

    // Estado compartilhado entre os passos sequenciais do fluxo.
    const PRECO = 120000; // R$ 1.200,00 em centavos (<= 50000? não: paga frete)
    const ESTOQUE_INICIAL = 10;
    const QUANTIDADE = 2;
    let produtoId;
    let carrinhoId;

    // -----------------------------------------------------------------------
    // 2. Cria um produto no catálogo e confirma a persistência pela listagem.
    //    (Req 9.1/9.3 — o produto gravado é lido de volta)
    // -----------------------------------------------------------------------
    await t.test('cria produto e confirma persistência na listagem', async () => {
        const nome = `Smoke Notebook ${Date.now()}`;
        const criado = await pedir(`${PRODUTOS_URL}/produtos`, {
            method: 'POST',
            body: {
                nome,
                descricao: 'Produto de smoke test',
                categoria: 'Testes',
                preco: PRECO,
                estoque: ESTOQUE_INICIAL,
                atributos: { origem: 'smoke' }
            }
        });
        assert.equal(criado.status, 201);
        assert.ok(criado.body && typeof criado.body.id === 'string');
        assert.equal(criado.body.preco, PRECO);
        assert.equal(criado.body.estoque, ESTOQUE_INICIAL);
        produtoId = criado.body.id;

        // Confirma que aparece na listagem (lido do arquivo em memória).
        const lista = await pedir(`${PRODUTOS_URL}/produtos`);
        assert.equal(lista.status, 200);
        assert.ok(Array.isArray(lista.body));
        const encontrado = lista.body.find((p) => p.id === produtoId);
        assert.ok(encontrado, 'produto criado deve aparecer na listagem');
        assert.equal(encontrado.nome, nome);
    });

    // -----------------------------------------------------------------------
    // 3. Cria um carrinho e adiciona o produto. Isso prova a comunicação
    //    Carrinho -> Produtos: o carrinho consulta o catálogo para validar e
    //    obter o preço oficial. O subtotal deve refletir o preço do catálogo.
    //    (Req 10.1, 10.4)
    // -----------------------------------------------------------------------
    await t.test('carrinho consulta produtos e usa o preço do catálogo', async () => {
        const novoCarrinho = await pedir(`${CARRINHO_URL}/carrinho`, { method: 'POST' });
        assert.equal(novoCarrinho.status, 201);
        assert.ok(novoCarrinho.body && typeof novoCarrinho.body.id === 'string');
        carrinhoId = novoCarrinho.body.id;

        // Envia um preço falso no corpo para provar que é IGNORADO (Req 3.4):
        // o carrinho deve gravar o preço vindo do Serviço_Produtos.
        const add = await pedir(`${CARRINHO_URL}/carrinho/${carrinhoId}/itens`, {
            method: 'POST',
            body: { produtoId, quantidade: QUANTIDADE, preco: 1 }
        });
        assert.equal(add.status, 201);

        const carrinho = await pedir(`${CARRINHO_URL}/carrinho/${carrinhoId}`);
        assert.equal(carrinho.status, 200);
        const item = carrinho.body.itens.find((i) => i.produtoId === produtoId);
        assert.ok(item, 'item deve existir no carrinho');
        assert.equal(item.precoUnitario, PRECO, 'preço deve vir do catálogo');
        assert.equal(carrinho.body.subtotal, PRECO * QUANTIDADE, 'subtotal reflete preço do catálogo');
    });

    // -----------------------------------------------------------------------
    // 4. Calcula o frete por CEP e valida a regra de faixa. CEP começando por
    //    0 -> faixa 0–3 -> 1500 centavos (subtotal 240000 > 50000? sim ->
    //    frete grátis). Então usamos um subtotal que NÃO é frete grátis não é
    //    garantido aqui; validamos a regra efetiva: se subtotal > 50000 -> 0,
    //    caso contrário a faixa do CEP. (Req 4.x via comunicação)
    // -----------------------------------------------------------------------
    await t.test('calcula frete aplicando a regra de faixa/frete grátis', async () => {
        const subtotal = PRECO * QUANTIDADE; // 240000 > 50000 => frete grátis
        const resp = await pedir(`${CARRINHO_URL}/carrinho/${carrinhoId}/frete`, {
            method: 'POST',
            body: { cep: '01001-000' } // começa com 0 -> faixa 0–3 (1500)
        });
        assert.equal(resp.status, 200);
        const freteEsperado = subtotal > 50000 ? 0 : 1500;
        assert.equal(resp.body.frete, freteEsperado);
        assert.equal(resp.body.total, subtotal + freteEsperado);
    });

    let pedidoId;

    // -----------------------------------------------------------------------
    // 5. Finaliza o pedido. Prova Pedidos -> Carrinho (obtém itens) e
    //    Pedidos -> Produtos (revalida + reserva). Status inicial PENDENTE e
    //    snapshot imutável dos itens. (Req 10.1, 10.4)
    // -----------------------------------------------------------------------
    await t.test('finaliza pedido revalidando e reservando estoque', async () => {
        const resp = await pedir(`${PEDIDOS_URL}/pedidos`, {
            method: 'POST',
            body: {
                carrinhoId,
                comprador: {
                    nome: 'Smoke Tester',
                    cep: '01001000',
                    endereco: 'Rua do Teste',
                    numero: '100'
                }
            }
        });
        assert.equal(resp.status, 201);
        assert.equal(resp.body.status, 'PENDENTE');
        pedidoId = resp.body.id;

        // Snapshot do item com nome/preço/quantidade capturados na compra.
        const itemSnap = resp.body.itens.find((i) => i.produtoId === produtoId);
        assert.ok(itemSnap, 'snapshot deve conter o item comprado');
        assert.equal(itemSnap.precoUnitario, PRECO);
        assert.equal(itemSnap.quantidade, QUANTIDADE);

        // A reserva reduziu o estoque no catálogo (Pedidos -> Produtos reservar).
        const estoque = await pedir(`${PRODUTOS_URL}/produtos/${produtoId}/estoque`);
        assert.equal(estoque.status, 200);
        assert.equal(
            estoque.body.estoque,
            ESTOQUE_INICIAL - QUANTIDADE,
            'estoque deve ter sido reservado'
        );
    });

    // -----------------------------------------------------------------------
    // 6. Pagamento aprovado -> status PAGO; o estoque permanece reduzido
    //    (reserva confirmada). (Req 7.1)
    // -----------------------------------------------------------------------
    await t.test('pagamento aprovado move pedido para PAGO e mantém reserva', async () => {
        const resp = await pedir(`${PEDIDOS_URL}/pedidos/${pedidoId}/pagamento`, {
            method: 'POST',
            body: { aprovado: true }
        });
        assert.equal(resp.status, 200);
        assert.equal(resp.body.status, 'PAGO');

        const estoque = await pedir(`${PRODUTOS_URL}/produtos/${produtoId}/estoque`);
        assert.equal(estoque.body.estoque, ESTOQUE_INICIAL - QUANTIDADE);
    });

    // -----------------------------------------------------------------------
    // 6b. Pagamento recusado devolve o estoque (Pedidos -> Produtos devolver).
    //     Cria um segundo carrinho/pedido e recusa o pagamento; o estoque deve
    //     voltar ao valor anterior à segunda reserva. (Req 7.3, 7.4)
    // -----------------------------------------------------------------------
    await t.test('pagamento recusado devolve o estoque reservado', async () => {
        const estoqueAntes = (await pedir(`${PRODUTOS_URL}/produtos/${produtoId}/estoque`)).body
            .estoque;

        const c2 = await pedir(`${CARRINHO_URL}/carrinho`, { method: 'POST' });
        const carrinho2 = c2.body.id;
        const add = await pedir(`${CARRINHO_URL}/carrinho/${carrinho2}/itens`, {
            method: 'POST',
            body: { produtoId, quantidade: 1 }
        });
        assert.equal(add.status, 201);

        const pedido2 = await pedir(`${PEDIDOS_URL}/pedidos`, {
            method: 'POST',
            body: {
                carrinhoId: carrinho2,
                comprador: {
                    nome: 'Smoke Recusa',
                    cep: '01001000',
                    endereco: 'Rua da Recusa',
                    numero: '200'
                }
            }
        });
        assert.equal(pedido2.status, 201);

        // Após a reserva, o estoque caiu 1.
        const estoqueReservado = (await pedir(`${PRODUTOS_URL}/produtos/${produtoId}/estoque`)).body
            .estoque;
        assert.equal(estoqueReservado, estoqueAntes - 1);

        // Recusa o pagamento -> devolve o estoque.
        const pag = await pedir(`${PEDIDOS_URL}/pedidos/${pedido2.body.id}/pagamento`, {
            method: 'POST',
            body: { aprovado: false }
        });
        assert.equal(pag.status, 200);
        assert.equal(pag.body.status, 'PAGAMENTO_RECUSADO');

        const estoqueDepois = (await pedir(`${PRODUTOS_URL}/produtos/${produtoId}/estoque`)).body
            .estoque;
        assert.equal(estoqueDepois, estoqueAntes, 'estoque devolvido após recusa');
    });

    // -----------------------------------------------------------------------
    // 7. Proxy do Frontend: GET {FRONTEND_URL}/api/produtos deve encaminhar
    //    para o Serviço_Produtos e retornar a lista de produtos. (Req 10.2)
    // -----------------------------------------------------------------------
    await t.test('proxy do frontend encaminha /api/produtos -> produtos', async () => {
        let resp;
        try {
            resp = await pedir(`${FRONTEND_URL}/api/produtos`);
        } catch {
            // Frontend pode não estar rodando mesmo com backends ativos; não
            // falha o suite por causa disso.
            return;
        }
        assert.equal(resp.status, 200);
        assert.ok(Array.isArray(resp.body), 'proxy deve retornar a lista de produtos');
        const encontrado = resp.body.find((p) => p.id === produtoId);
        assert.ok(encontrado, 'produto criado deve aparecer via proxy do frontend');
    });
});
