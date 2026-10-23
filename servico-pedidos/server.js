// Serviço_Pedidos (porta 3003)
//
// Responsável por criar pedidos a partir de um carrinho, revalidar/reservar
// estoque, registrar snapshot imutável, processar pagamento simulado e
// gerenciar status/histórico; persistência exclusiva em pedidos.json (via
// store.js). O modelo do Pedido e a geração de id ficam em pedido.js.
//
// Endpoints:
//   GET  /health                -> 200 { "status": "ok" } (healthcheck Compose)
//   GET  /pedidos               -> lista pedidos (id, data, total, status) (200)
//   GET  /pedidos/:id           -> pedido completo com snapshot (200 / 404)
//   POST /pedidos               -> cria pedido a partir do carrinho (201/400/404/409/503)
//   POST /pedidos/:id/pagamento -> pagamento simulado + status (200/400/404/409)
//
// Erros seguem o formato { "erro": "..." }. Valores monetários em centavos.
const path = require('path');
const express = require('express');

const { createStore } = require('./store');
const { criarPedido, STATUS } = require('./pedido');
const carrinhoClient = require('./carrinhoClient');
const produtosClient = require('./produtosClient');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;

// Store de persistência exclusivo do Serviço_Pedidos (pedidos.json).
const store = createStore(path.join(__dirname, 'data', 'pedidos.json'));

// Inicializa o store no carregamento do módulo: cria o arquivo se ausente e
// carrega os pedidos existentes em memória. A promise é exposta para que o
// bootstrapping e eventuais testes possam aguardar a prontidão.
const prontidao = store.init().catch((err) => {
    console.error('Falha ao inicializar o store de pedidos:', err);
    throw err;
});

// GET /health — verificação de saúde simples para healthcheck do Compose.
// Retorna 200 { "status": "ok" }. Caminho distinto de /pedidos, sem colisão.
// As chamadas aos demais serviços usam PRODUTOS_URL/CARRINHO_URL (via clients).
// (Requisitos 12.7, 12.1, 12.5)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// GET /pedidos — lista todos os pedidos registrados com id, data, total e
// status. (Requisito 8.1)
//
// Retorna um resumo de cada pedido (id, data, total, status), suficiente para
// a tela de histórico; os detalhes completos ficam em GET /pedidos/:id.
app.get('/pedidos', (req, res) => {
    const pedidos = store.getAll();
    const resumo = pedidos.map((p) => ({
        id: p.id,
        data: p.data,
        total: p.total,
        status: p.status
    }));
    res.status(200).json(resumo);
});

// GET /pedidos/:id — retorna o pedido completo por id, incluindo o snapshot
// imutável dos itens e quantidades. (Requisitos 8.2, 8.3)
app.get('/pedidos/:id', (req, res) => {
    const pedido = store.getAll().find((p) => p.id === req.params.id);
    if (!pedido) {
        return res.status(404).json({ erro: 'Pedido não encontrado' });
    }
    res.status(200).json(pedido);
});

// ---------------------------------------------------------------------------
// Fluxo de criação de pedido (tarefa 6.2) — Requisito 6.
//
// POST /pedidos (`{ carrinhoId, comprador: { nome, cep, endereco, numero,
// complemento? } }`):
//  1. Consulta GET /carrinho/:carrinhoId no Serviço_Carrinho para obter os
//     itens e os valores (subtotal/frete/total). (Requisito 6.1)
//  2. Revalida cada item junto ao Serviço_Produtos: existência, preço e
//     estoque. (Requisito 6.2)
//  3. Se qualquer item tiver estoque insuficiente, recusa com 409 "Estoque
//     insuficiente" SEM reservar nada (valida tudo primeiro). (Requisito 6.6)
//  4. Reserva a quantidade de cada produto via POST /produtos/:id/reservar.
//     (Requisito 6.3)
//  5. Cria o Pedido com snapshot imutável, status PENDENTE e dados do
//     comprador (incluindo complemento opcional). (Requisitos 6.4, 6.7)
//
// Indisponibilidade de qualquer serviço -> 503 amigável (Requisito 10.3).
// A idempotência (6.5) é a PRÓXIMA tarefa (6.3): o ponto de inserção está
// marcado abaixo, antes da reserva/criação.
// ---------------------------------------------------------------------------

const CAMPOS_COMPRADOR_OBRIGATORIOS = ['nome', 'cep', 'endereco', 'numero'];

// Status que mantêm um pedido "ativo" para fins de idempotência. Um pedido
// recusado (PAGAMENTO_RECUSADO) ou cancelado (CANCELADO) NÃO bloqueia uma nova
// tentativa de finalização — o usuário pode tentar novamente após a recusa.
// Apenas PENDENTE e PAGO contam como duplicata. (Requisito 6.5)
const STATUS_ATIVOS = Object.freeze(new Set([STATUS.PENDENTE, STATUS.PAGO]));

/**
 * Deriva a chave de idempotência da finalização. Prefere o cabeçalho
 * `Idempotency-Key` enviado pelo Frontend; na ausência, usa o próprio
 * `carrinhoId`. (Requisito 6.5)
 *
 * @param {import('express').Request} req
 * @param {string} carrinhoId
 * @returns {string}
 */
function derivarChaveIdempotencia(req, carrinhoId) {
    const header = req.get && req.get('Idempotency-Key');
    if (typeof header === 'string' && header.trim() !== '') {
        return header.trim();
    }
    return carrinhoId;
}

/**
 * Procura um pedido ativo já criado com a mesma chave de idempotência. Um
 * pedido ativo (PENDENTE ou PAGO) bloqueia a criação de duplicatas; pedidos
 * recusados/cancelados são ignorados para permitir uma nova tentativa.
 * (Requisito 6.5)
 *
 * @param {string} chaveIdempotencia
 * @returns {object|undefined} o pedido existente, ou undefined.
 */
function encontrarPedidoAtivoPorChave(chaveIdempotencia) {
    return store
        .getAll()
        .find(
            (p) =>
                p.chaveIdempotencia === chaveIdempotencia &&
                STATUS_ATIVOS.has(p.status)
        );
}

/**
 * Valida os dados do comprador: nome, cep, endereco e numero são obrigatórios
 * (string não vazia); complemento é opcional. (Requisito 6.7)
 *
 * @param {object} comprador
 * @returns {string|null} mensagem de erro, ou null quando válido.
 */
function validarComprador(comprador) {
    if (!comprador || typeof comprador !== 'object') {
        return 'Dados do comprador são obrigatórios';
    }
    for (const campo of CAMPOS_COMPRADOR_OBRIGATORIOS) {
        const valor = comprador[campo];
        if (typeof valor !== 'string' || valor.trim() === '') {
            return `Campo do comprador obrigatório: ${campo}`;
        }
    }
    return null;
}

app.post('/pedidos', async (req, res) => {
    const { carrinhoId, comprador } = req.body || {};

    if (typeof carrinhoId !== 'string' || carrinhoId.length === 0) {
        return res.status(400).json({ erro: 'carrinhoId é obrigatório' });
    }

    const erroComprador = validarComprador(comprador);
    if (erroComprador) {
        return res.status(400).json({ erro: erroComprador });
    }

    // Idempotência (tarefa 6.3, Requisito 6.5): deriva a chave (cabeçalho
    // `Idempotency-Key` ou o próprio carrinhoId) e, se já existir um pedido
    // ativo (PENDENTE/PAGO) com essa chave, retorna-o com 200 sem consultar o
    // carrinho, revalidar ou reservar estoque novamente. A verificação ocorre
    // ANTES de qualquer chamada de rede, garantindo que não há reserva dupla.
    const chaveIdempotencia = derivarChaveIdempotencia(req, carrinhoId);
    const pedidoExistente = encontrarPedidoAtivoPorChave(chaveIdempotencia);
    if (pedidoExistente) {
        return res.status(200).json(pedidoExistente);
    }

    // 1. Consulta o carrinho de origem (itens + valores). (Requisito 6.1)
    let carrinhoInfo;
    try {
        carrinhoInfo = await carrinhoClient.obterCarrinho(carrinhoId);
    } catch (err) {
        return res.status(503).json({
            erro: 'Serviço de carrinho temporariamente indisponível. Tente novamente.'
        });
    }
    if (!carrinhoInfo.encontrado) {
        return res.status(404).json({ erro: 'Carrinho não encontrado' });
    }

    const carrinho = carrinhoInfo.carrinho || {};
    const itensCarrinho = Array.isArray(carrinho.itens) ? carrinho.itens : [];
    if (itensCarrinho.length === 0) {
        return res.status(400).json({ erro: 'Carrinho vazio' });
    }

    // 2. Revalida TODOS os itens junto ao Serviço_Produtos antes de reservar
    //    qualquer coisa: existência, preço/atributos (para o snapshot) e
    //    estoque disponível. (Requisitos 6.2, 6.6)
    const itensValidados = [];
    try {
        for (const item of itensCarrinho) {
            const produtoInfo = await produtosClient.obterProduto(item.produtoId);
            if (!produtoInfo.encontrado) {
                return res.status(404).json({ erro: 'Produto não encontrado' });
            }
            const estoqueInfo = await produtosClient.obterEstoque(item.produtoId);
            if (!estoqueInfo.encontrado) {
                return res.status(404).json({ erro: 'Produto não encontrado' });
            }
            if (item.quantidade > estoqueInfo.estoque) {
                // Estoque insuficiente -> recusa sem reservar nada. (6.6)
                return res.status(409).json({ erro: 'Estoque insuficiente' });
            }

            // Snapshot: nome/preço/atributos vêm do catálogo no momento da
            // compra; o preço oficial sobrepõe qualquer valor do carrinho. (6.7)
            const produto = produtoInfo.produto;
            itensValidados.push({
                produtoId: item.produtoId,
                nome: produto.nome,
                precoUnitario: produto.preco,
                quantidade: item.quantidade,
                atributos:
                    produto.atributos && typeof produto.atributos === 'object'
                        ? { ...produto.atributos }
                        : {}
            });
        }
    } catch (err) {
        return res.status(503).json({
            erro: 'Serviço de produtos temporariamente indisponível. Tente novamente.'
        });
    }

    // 3. Valida-tudo-depois-reserva: reserva cada produto. Se uma reserva
    //    falhar inesperadamente após a validação, tenta compensar as reservas
    //    já efetuadas (devolver) para não deixar estoque reservado órfão.
    const reservados = [];
    for (const item of itensValidados) {
        let resultado;
        try {
            resultado = await produtosClient.reservar(item.produtoId, item.quantidade);
        } catch (err) {
            await desfazerReservas(reservados);
            return res.status(503).json({
                erro: 'Serviço de produtos temporariamente indisponível. Tente novamente.'
            });
        }
        if (!resultado.ok) {
            // A validação passou, mas a reserva foi recusada (corrida de
            // estoque ou produto removido): compensa o que já foi reservado.
            await desfazerReservas(reservados);
            if (resultado.estoqueInsuficiente) {
                return res.status(409).json({ erro: 'Estoque insuficiente' });
            }
            return res.status(404).json({ erro: 'Produto não encontrado' });
        }
        reservados.push(item);
    }

    // 4/5. Cria o Pedido com snapshot imutável, valores do carrinho e status
    //      PENDENTE; persiste em pedidos.json. (Requisitos 6.4, 6.7)
    const subtotal = Number(carrinho.subtotal) || 0;
    const frete = Number(carrinho.frete) || 0;
    const pedido = criarPedido({
        carrinhoId,
        chaveIdempotencia,
        comprador,
        itens: itensValidados,
        subtotal,
        frete,
        total: carrinho.total == null ? subtotal + frete : Number(carrinho.total) || 0,
        status: STATUS.PENDENTE
    });

    const pedidos = store.getAll();
    await store.save([...pedidos, pedido]);

    res.status(201).json(pedido);
});

// ---------------------------------------------------------------------------
// Pagamento simulado e gestão de status (tarefa 6.6) — Requisito 7.
//
// POST /pedidos/:id/pagamento (`{ aprovado: boolean }`):
//  - 404 { erro: "Pedido não encontrado" } se o pedido não existir.
//  - 400 { erro } se `aprovado` não for booleano.
//  - 409 { erro: "Pedido não está pendente" } se o pedido não estiver
//    PENDENTE (evita duplo processamento: dupla limpeza de carrinho ou dupla
//    devolução de estoque).
//  - aprovado = true  -> status PAGO; solicita DELETE /carrinho/:id/itens para
//    limpar o carrinho. A limpeza é best-effort: se o Serviço_Carrinho estiver
//    indisponível, o pagamento permanece aprovado (200 com o pedido PAGO).
//    (Requisitos 7.1, 7.2)
//  - aprovado = false -> status PAGAMENTO_RECUSADO; solicita POST
//    /produtos/:id/devolver para cada item do snapshot, devolvendo o estoque
//    reservado. (Requisitos 7.3, 7.4)
//  - O status fica restrito a PENDENTE | PAGO | PAGAMENTO_RECUSADO | CANCELADO
//    (via constantes STATUS). O snapshot de itens NUNCA é alterado pelo
//    pagamento — apenas o campo `status` muda. (Requisitos 7.5, 7.7)
// ---------------------------------------------------------------------------
app.post('/pedidos/:id/pagamento', async (req, res) => {
    const { aprovado } = req.body || {};

    if (typeof aprovado !== 'boolean') {
        return res
            .status(400)
            .json({ erro: 'Campo "aprovado" é obrigatório e deve ser booleano' });
    }

    const pedidos = store.getAll();
    const indice = pedidos.findIndex((p) => p.id === req.params.id);
    if (indice === -1) {
        return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    const pedido = pedidos[indice];

    // Só um pedido PENDENTE pode ser pago/recusado. Reprocessar um pedido já
    // PAGO/RECUSADO/CANCELADO causaria dupla limpeza de carrinho ou dupla
    // devolução de estoque. (Requisito 7.5)
    if (pedido.status !== STATUS.PENDENTE) {
        return res.status(409).json({ erro: 'Pedido não está pendente' });
    }

    // Monta o pedido atualizado preservando o snapshot imutável de itens:
    // apenas o campo `status` muda. (Requisito 7.7)
    const novoStatus = aprovado ? STATUS.PAGO : STATUS.PAGAMENTO_RECUSADO;
    const pedidoAtualizado = { ...pedido, status: novoStatus };

    // Persiste a mudança de status antes dos efeitos colaterais de rede, de
    // modo que o estado do pedido reflita o resultado do pagamento mesmo que
    // a limpeza do carrinho / devolução de estoque enfrente indisponibilidade.
    const novosPedidos = pedidos.slice();
    novosPedidos[indice] = pedidoAtualizado;
    await store.save(novosPedidos);

    if (aprovado) {
        // Pagamento aprovado -> limpa o carrinho associado (best-effort). Uma
        // indisponibilidade do Serviço_Carrinho não invalida o pagamento já
        // aprovado. (Requisito 7.2)
        try {
            await carrinhoClient.limparItens(pedidoAtualizado.carrinhoId);
        } catch (err) {
            // best-effort: mantém o pedido PAGO mesmo se a limpeza falhar.
        }
    } else {
        // Pagamento recusado -> devolve o estoque reservado de cada item do
        // snapshot (best-effort). (Requisito 7.4)
        for (const item of pedidoAtualizado.itens) {
            try {
                await produtosClient.devolver(item.produtoId, item.quantidade);
            } catch (err) {
                // best-effort: a mudança de status já foi persistida.
            }
        }
    }

    res.status(200).json(pedidoAtualizado);
});

/**
 * Compensa reservas já efetuadas chamando devolver para cada item. Usado em
 * falhas parciais durante a criação do pedido, para não deixar estoque
 * reservado sem um pedido correspondente. Erros de devolução são ignorados
 * (best-effort), pois a resposta de erro principal já será enviada.
 *
 * @param {Array<{ produtoId: string, quantidade: number }>} itens
 * @returns {Promise<void>}
 */
async function desfazerReservas(itens) {
    for (const item of itens) {
        try {
            await produtosClient.devolver(item.produtoId, item.quantidade);
        } catch (err) {
            // best-effort: ignora falhas de compensação.
        }
    }
}

if (require.main === module) {
    prontidao
        .then(() => {
            app.listen(PORT, '0.0.0.0', () => {
                console.log(`Serviço_Pedidos executando na porta ${PORT}`);
            });
        })
        .catch(() => {
            process.exit(1);
        });
}

module.exports = app;
module.exports.store = store;
module.exports.prontidao = prontidao;
