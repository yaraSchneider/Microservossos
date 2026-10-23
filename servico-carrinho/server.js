// Serviço_Carrinho (porta 3002)
//
// Responsável por criar carrinhos, gerenciar itens e calcular subtotal/frete/
// total; persistência exclusiva em carrinhos.json (via store.js). O modelo do
// Carrinho e a geração de id ficam em carrinho.js.
//
// Endpoints desta tarefa (4.1):
//   POST   /carrinho                       -> cria carrinho vazio (201)
//   GET    /carrinho/:id                    -> retorna o carrinho (200 / 404)
//
// Gestão de itens com integração REST ao Serviço_Produtos (tarefa 4.4):
//   POST   /carrinho/:id/itens             -> adiciona item (201/400/404/409)
//   PUT    /carrinho/:id/itens/:produtoId  -> altera quantidade (200/404/409)
//   DELETE /carrinho/:id/itens/:produtoId  -> remove um item (200/404)
//   DELETE /carrinho/:id/itens             -> limpa todos os itens (200/404)
//
// Endpoint de saúde (tarefa 4.9, Requisitos 12.7, 12.1):
//   GET    /health                         -> 200 { "status": "ok" }
//
// As rotas de itens consultam o Serviço_Produtos (via produtosClient) para
// confirmar existência, validar estoque e obter o preço unitário oficial
// (ignorando qualquer preço enviado pelo Frontend). O frete por CEP é da
// tarefa 4.6. Erros seguem o formato { "erro": "..." }. Valores monetários
// permanecem em centavos (inteiros).
const path = require('path');
const express = require('express');

const { createStore } = require('./store');
const { criarCarrinho, calcularValores, calcularSubtotal } = require('./carrinho');
const { cepValido, normalizarCep, calcularFrete } = require('./frete');
const produtosClient = require('./produtosClient');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;

// Store de persistência exclusivo do Serviço_Carrinho (carrinhos.json).
const store = createStore(path.join(__dirname, 'data', 'carrinhos.json'));

// Inicializa o store no carregamento do módulo: cria o arquivo se ausente e
// carrega os carrinhos existentes em memória. A promise é exposta para que o
// bootstrapping e eventuais testes possam aguardar a prontidão.
const prontidao = store.init().catch((err) => {
    console.error('Falha ao inicializar o store de carrinhos:', err);
    throw err;
});

// GET /health — verificação de saúde simples para healthcheck do Compose.
// Retorna 200 { "status": "ok" }. Caminho distinto de /carrinho, sem colisão.
// As chamadas ao catálogo usam PRODUTOS_URL (via produtosClient). (Requisitos 12.7, 12.1, 12.5)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// POST /carrinho — cria um carrinho vazio com id único e persiste.
// (Requisitos 3.1, 9.1, 9.2)
app.post('/carrinho', async (req, res) => {
    const carrinho = criarCarrinho();

    const carrinhos = store.getAll();
    const novaLista = [...carrinhos, carrinho];
    await store.save(novaLista);

    res.status(201).json(carrinho);
});

// GET /carrinho/:id — retorna o carrinho por id com subtotal/frete/total
// recalculados. (Requisitos 3.9, 5.1, 5.2, 5.3)
//
// Os itens e o precoUnitario gravados são a fonte da verdade; o subtotal é
// recomputado na leitura e o total = subtotal + frete (frete 0 quando ainda
// não calculado). O recálculo na leitura dispensa persistência neste GET.
app.get('/carrinho/:id', (req, res) => {
    const carrinho = store.getAll().find((c) => c.id === req.params.id);
    if (!carrinho) {
        return res.status(404).json({ erro: 'Carrinho não encontrado' });
    }
    res.json(calcularValores(carrinho));
});

// ---------------------------------------------------------------------------
// Gestão de itens do carrinho (tarefa 4.4) — integração REST ao Serviço_Produtos.
//
// Regras principais (Requisitos 3.2, 3.3, 3.4, 3.5, 3.6, 3.7):
//  - Ao adicionar/alterar item, consulta o Serviço_Produtos para confirmar a
//    existência (GET /produtos/:id) e validar o estoque disponível
//    (GET /produtos/:id/estoque).
//  - Se a quantidade resultante exceder o estoque -> 409 "Estoque insuficiente".
//  - O precoUnitario gravado é SEMPRE o obtido do catálogo; qualquer `preco`
//    enviado no corpo é ignorado (Requisito 3.4).
//  - Toda mutação é persistida via store.save(...).
// ---------------------------------------------------------------------------

/**
 * Valida que `quantidade` é um inteiro positivo (>= 1). Rejeita 0, negativos,
 * não inteiros e tipos não numéricos.
 *
 * @param {unknown} valor
 * @returns {boolean}
 */
function isQuantidadePositiva(valor) {
    return typeof valor === 'number' && Number.isInteger(valor) && valor >= 1;
}

/**
 * Localiza um carrinho em memória pelo id.
 *
 * @param {string} id
 * @returns {{ indice: number, carrinho: object | undefined }}
 */
function localizarCarrinho(id) {
    const carrinhos = store.getAll();
    const indice = carrinhos.findIndex((c) => c.id === id);
    return { carrinhos, indice, carrinho: indice === -1 ? undefined : carrinhos[indice] };
}

/**
 * Persiste um carrinho atualizado substituindo-o na lista em memória.
 *
 * @param {Array} carrinhos Lista atual de carrinhos.
 * @param {number} indice Índice do carrinho a substituir.
 * @param {object} carrinhoAtualizado
 * @returns {Promise<void>}
 */
async function persistirCarrinho(carrinhos, indice, carrinhoAtualizado) {
    const novaLista = carrinhos.map((c, i) => (i === indice ? carrinhoAtualizado : c));
    await store.save(novaLista);
}

// POST /carrinho/:id/itens — adiciona (ou incrementa) um item consultando o
// catálogo. Corpo: { produtoId, quantidade }. (Requisitos 3.2, 3.3, 3.4)
app.post('/carrinho/:id/itens', async (req, res) => {
    const { produtoId, quantidade } = req.body || {};

    if (typeof produtoId !== 'string' || produtoId.length === 0) {
        return res.status(400).json({ erro: 'produtoId é obrigatório' });
    }
    if (!isQuantidadePositiva(quantidade)) {
        return res.status(400).json({ erro: 'Quantidade inválida' });
    }

    const { carrinhos, indice, carrinho } = localizarCarrinho(req.params.id);
    if (!carrinho) {
        return res.status(404).json({ erro: 'Carrinho não encontrado' });
    }

    // Consulta o Serviço_Produtos: existência + preço oficial e estoque.
    let produtoInfo;
    let estoqueInfo;
    try {
        produtoInfo = await produtosClient.obterProduto(produtoId);
        if (!produtoInfo.encontrado) {
            return res.status(404).json({ erro: 'Produto não encontrado' });
        }
        estoqueInfo = await produtosClient.obterEstoque(produtoId);
        if (!estoqueInfo.encontrado) {
            return res.status(404).json({ erro: 'Produto não encontrado' });
        }
    } catch (err) {
        return res.status(503).json({
            erro: 'Serviço de produtos temporariamente indisponível. Tente novamente.'
        });
    }

    // Quantidade resultante: adiciona à quantidade já presente no carrinho,
    // revalidando contra o estoque disponível. (Requisito 3.3)
    const itens = Array.isArray(carrinho.itens) ? carrinho.itens : [];
    const itemExistente = itens.find((it) => it.produtoId === produtoId);
    const quantidadeResultante = (itemExistente ? itemExistente.quantidade : 0) + quantidade;

    if (quantidadeResultante > estoqueInfo.estoque) {
        return res.status(409).json({ erro: 'Estoque insuficiente' });
    }

    // precoUnitario SEMPRE do catálogo; ignora qualquer preço do corpo. (3.4)
    const precoUnitario = produtoInfo.produto.preco;

    let novosItens;
    if (itemExistente) {
        novosItens = itens.map((it) =>
            it.produtoId === produtoId
                ? { ...it, quantidade: quantidadeResultante, precoUnitario }
                : it
        );
    } else {
        novosItens = [...itens, { produtoId, quantidade, precoUnitario }];
    }

    const carrinhoAtualizado = calcularValores({ ...carrinho, itens: novosItens });
    await persistirCarrinho(carrinhos, indice, carrinhoAtualizado);

    res.status(201).json(carrinhoAtualizado);
});

// PUT /carrinho/:id/itens/:produtoId — define a quantidade de um item
// existente, revalidando o estoque. Corpo: { quantidade }. (Requisitos 3.3, 3.5)
app.put('/carrinho/:id/itens/:produtoId', async (req, res) => {
    const { quantidade } = req.body || {};
    const { produtoId } = req.params;

    if (!isQuantidadePositiva(quantidade)) {
        return res.status(400).json({ erro: 'Quantidade inválida' });
    }

    const { carrinhos, indice, carrinho } = localizarCarrinho(req.params.id);
    if (!carrinho) {
        return res.status(404).json({ erro: 'Carrinho não encontrado' });
    }

    const itens = Array.isArray(carrinho.itens) ? carrinho.itens : [];
    const itemExistente = itens.find((it) => it.produtoId === produtoId);
    if (!itemExistente) {
        return res.status(404).json({ erro: 'Item não encontrado no carrinho' });
    }

    // Revalida existência, preço oficial e estoque junto ao catálogo.
    let produtoInfo;
    let estoqueInfo;
    try {
        produtoInfo = await produtosClient.obterProduto(produtoId);
        if (!produtoInfo.encontrado) {
            return res.status(404).json({ erro: 'Produto não encontrado' });
        }
        estoqueInfo = await produtosClient.obterEstoque(produtoId);
        if (!estoqueInfo.encontrado) {
            return res.status(404).json({ erro: 'Produto não encontrado' });
        }
    } catch (err) {
        return res.status(503).json({
            erro: 'Serviço de produtos temporariamente indisponível. Tente novamente.'
        });
    }

    if (quantidade > estoqueInfo.estoque) {
        return res.status(409).json({ erro: 'Estoque insuficiente' });
    }

    // precoUnitario SEMPRE do catálogo (mantém a regra 3.4 em alterações).
    const precoUnitario = produtoInfo.produto.preco;
    const novosItens = itens.map((it) =>
        it.produtoId === produtoId ? { ...it, quantidade, precoUnitario } : it
    );

    const carrinhoAtualizado = calcularValores({ ...carrinho, itens: novosItens });
    await persistirCarrinho(carrinhos, indice, carrinhoAtualizado);

    res.json(carrinhoAtualizado);
});

// DELETE /carrinho/:id/itens/:produtoId — remove um item do carrinho. (3.6)
app.delete('/carrinho/:id/itens/:produtoId', async (req, res) => {
    const { produtoId } = req.params;

    const { carrinhos, indice, carrinho } = localizarCarrinho(req.params.id);
    if (!carrinho) {
        return res.status(404).json({ erro: 'Carrinho não encontrado' });
    }

    const itens = Array.isArray(carrinho.itens) ? carrinho.itens : [];
    const existe = itens.some((it) => it.produtoId === produtoId);
    if (!existe) {
        return res.status(404).json({ erro: 'Item não encontrado no carrinho' });
    }

    const novosItens = itens.filter((it) => it.produtoId !== produtoId);
    const carrinhoAtualizado = calcularValores({ ...carrinho, itens: novosItens });
    await persistirCarrinho(carrinhos, indice, carrinhoAtualizado);

    res.json(carrinhoAtualizado);
});

// DELETE /carrinho/:id/itens — limpa todos os itens do carrinho. (3.7)
app.delete('/carrinho/:id/itens', async (req, res) => {
    const { carrinhos, indice, carrinho } = localizarCarrinho(req.params.id);
    if (!carrinho) {
        return res.status(404).json({ erro: 'Carrinho não encontrado' });
    }

    const carrinhoAtualizado = calcularValores({ ...carrinho, itens: [] });
    await persistirCarrinho(carrinhos, indice, carrinhoAtualizado);

    res.json(carrinhoAtualizado);
});

// ---------------------------------------------------------------------------
// Cálculo de frete por CEP (tarefa 4.6) — Requisito 4.
//
// POST /carrinho/:id/frete (`{ cep }`):
//  - Normaliza o CEP removendo hífen/espaços; exige exatamente 8 dígitos,
//    senão 400 { erro: "CEP inválido" } (Requisitos 4.6, 4.7).
//  - Frete base pelo primeiro dígito do CEP: 0–3 → 1500, 4–6 → 2500,
//    7–9 → 3500 centavos (Requisitos 4.2, 4.3, 4.4).
//  - Se subtotal > 50000 centavos, frete grátis (0), sobrepondo o CEP
//    (Requisito 4.5).
//  - Persiste o cep (normalizado) e o frete no carrinho e retorna o carrinho
//    com subtotal/frete/total recalculados.
// ---------------------------------------------------------------------------
app.post('/carrinho/:id/frete', async (req, res) => {
    const { cep } = req.body || {};

    const { carrinhos, indice, carrinho } = localizarCarrinho(req.params.id);
    if (!carrinho) {
        return res.status(404).json({ erro: 'Carrinho não encontrado' });
    }

    if (!cepValido(cep)) {
        return res.status(400).json({ erro: 'CEP inválido' });
    }

    // Subtotal é a fonte da verdade a partir dos itens gravados.
    const subtotal = calcularSubtotal(carrinho.itens);
    const cepNormalizado = normalizarCep(cep);
    const frete = calcularFrete(cepNormalizado, subtotal);

    const carrinhoAtualizado = calcularValores({
        ...carrinho,
        cep: cepNormalizado,
        frete
    });
    await persistirCarrinho(carrinhos, indice, carrinhoAtualizado);

    res.json(carrinhoAtualizado);
});

if (require.main === module) {
    prontidao
        .then(() => {
            app.listen(PORT, '0.0.0.0', () => {
                console.log(`Serviço_Carrinho executando na porta ${PORT}`);
            });
        })
        .catch(() => {
            process.exit(1);
        });
}

module.exports = app;
module.exports.store = store;
module.exports.prontidao = prontidao;
