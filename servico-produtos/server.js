// Serviço_Produtos (porta 3001)
// Ponto de partida reaproveitado de microsservico-produtos/app.js, agora com
// persistência em produtos.json (via store.js) e validação/criação de produtos
// (via produto.js).
//
// Endpoints de catálogo (tarefa 2.3):
//   GET    /produtos        -> lista todos os produtos (200)
//   POST   /produtos        -> cria produto com id único (201 / 400)
//   GET    /produtos/:id    -> retorna produto por id (200 / 404)
//   PUT    /produtos/:id    -> atualiza produto existente (200 / 400 / 404)
//   DELETE /produtos/:id    -> remove produto (204 / 404)
//
// Endpoints internos de estoque (tarefa 2.5, Requisito 2):
//   GET  /produtos/:id/estoque   -> consulta quantidade disponível (200 / 404)
//   POST /produtos/:id/reservar  -> reduz estoque se disponível (200 / 409 / 404)
//   POST /produtos/:id/devolver  -> aumenta estoque reservado (200 / 404)
//
// Endpoint de saúde (tarefa 2.8, Requisito 12.7):
//   GET  /health                 -> 200 { "status": "ok" } (healthcheck Compose)
//
// Cada mutação é persistida de forma atômica via store.save(...).
// Erros seguem o formato { "erro": "mensagem" }. Preços permanecem em centavos
// (inteiros) e `atributos` é preservado como mapa dinâmico.
const path = require('path');
const express = require('express');

const { createStore } = require('./store');
const { criarProduto, validarProduto } = require('./produto');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Store de persistência exclusivo do Serviço_Produtos (produtos.json).
const store = createStore(path.join(__dirname, 'data', 'produtos.json'));

// Inicializa o store no carregamento do módulo: cria o arquivo se ausente e
// carrega os produtos existentes em memória. A promise é exposta para que o
// bootstrapping (tarefa 2.8) e eventuais testes possam aguardar a prontidão.
const prontidao = store.init().catch((err) => {
    console.error('Falha ao inicializar o store de produtos:', err);
    throw err;
});

// GET /health — verificação de saúde simples para healthcheck do Compose.
// Retorna 200 { "status": "ok" }. Caminho distinto de /produtos, sem colisão.
// (Requisitos 12.7, 12.1)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// GET /produtos — lista todos os produtos cadastrados. (Requisito 1.3)
app.get('/produtos', (req, res) => {
    res.json(store.getAll());
});

// POST /produtos — cria um produto com id único e persiste. (Requisitos 1.1, 1.2, 1.8)
app.post('/produtos', async (req, res) => {
    const resultado = criarProduto(req.body);
    if (!resultado.valido) {
        return res.status(400).json({ erro: resultado.erro });
    }

    const produtos = store.getAll();
    const novaLista = [...produtos, resultado.produto];
    await store.save(novaLista);

    res.status(201).json(resultado.produto);
});

// GET /produtos/:id — retorna um produto por id. (Requisitos 1.4, 1.5)
app.get('/produtos/:id', (req, res) => {
    const produto = store.getAll().find((p) => p.id === req.params.id);
    if (!produto) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.json(produto);
});

// PUT /produtos/:id — atualiza um produto existente (mantém o id) e persiste.
// (Requisitos 1.6, 1.8, 1.9)
app.put('/produtos/:id', async (req, res) => {
    const produtos = store.getAll();
    const indice = produtos.findIndex((p) => p.id === req.params.id);
    if (indice === -1) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    const resultado = validarProduto(req.body);
    if (!resultado.valido) {
        return res.status(400).json({ erro: resultado.erro });
    }

    // Mantém o mesmo id do produto existente.
    const atualizado = { id: produtos[indice].id, ...resultado.produto };
    const novaLista = produtos.map((p, i) => (i === indice ? atualizado : p));
    await store.save(novaLista);

    res.json(atualizado);
});

// DELETE /produtos/:id — remove um produto e persiste. (Requisito 1.7)
app.delete('/produtos/:id', async (req, res) => {
    const produtos = store.getAll();
    const existe = produtos.some((p) => p.id === req.params.id);
    if (!existe) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    const novaLista = produtos.filter((p) => p.id !== req.params.id);
    await store.save(novaLista);

    res.status(204).end();
});

// ---------------------------------------------------------------------------
// Endpoints internos de estoque (tarefa 2.5) — consumidos por Carrinho e
// Pedidos. (Requisito 2)
//
//   GET  /produtos/:id/estoque   -> consulta a quantidade disponível (200/404)
//   POST /produtos/:id/reservar  -> reduz o estoque se houver disponível
//                                   (200 / 409 / 404)
//   POST /produtos/:id/devolver  -> aumenta o estoque reservado (200 / 404)
//
// Observação de roteamento: estas rotas possuem um segmento de caminho extra
// (`/estoque`, `/reservar`, `/devolver`), portanto não colidem com
// `/produtos/:id`. `reservar` só reduz quando `estoque >= quantidade`; caso
// contrário retorna 409 sem alterar o estoque. Toda mutação é persistida de
// forma atômica via store.save(...). (Requisitos 2.2, 2.3)
// ---------------------------------------------------------------------------

/**
 * Valida `quantidade` recebida no corpo de reservar/devolver: deve ser um
 * inteiro maior ou igual a 1 (rejeita 0, negativos e não inteiros).
 *
 * @param {unknown} valor
 * @returns {boolean}
 */
function isQuantidadeValida(valor) {
    return typeof valor === 'number' && Number.isInteger(valor) && valor >= 1;
}

// GET /produtos/:id/estoque — consulta a quantidade disponível. (Requisito 2.1)
app.get('/produtos/:id/estoque', (req, res) => {
    const produto = store.getAll().find((p) => p.id === req.params.id);
    if (!produto) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.json({ id: produto.id, estoque: produto.estoque });
});

// POST /produtos/:id/reservar — reduz o estoque apenas se houver disponível.
// (Requisitos 2.2, 2.3)
app.post('/produtos/:id/reservar', async (req, res) => {
    const quantidade = req.body ? req.body.quantidade : undefined;
    if (!isQuantidadeValida(quantidade)) {
        return res.status(400).json({ erro: 'Quantidade inválida' });
    }

    const produtos = store.getAll();
    const indice = produtos.findIndex((p) => p.id === req.params.id);
    if (indice === -1) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    const produto = produtos[indice];
    // Estoque insuficiente: recusa sem alterar nada. (Requisito 2.3)
    if (produto.estoque < quantidade) {
        return res.status(409).json({ erro: 'Estoque insuficiente' });
    }

    // Reduz exatamente pela quantidade reservada e persiste. (Requisito 2.2)
    const atualizado = { ...produto, estoque: produto.estoque - quantidade };
    const novaLista = produtos.map((p, i) => (i === indice ? atualizado : p));
    await store.save(novaLista);

    res.json({ id: atualizado.id, estoque: atualizado.estoque });
});

// POST /produtos/:id/devolver — aumenta o estoque reservado. (Requisito 2.4)
app.post('/produtos/:id/devolver', async (req, res) => {
    const quantidade = req.body ? req.body.quantidade : undefined;
    if (!isQuantidadeValida(quantidade)) {
        return res.status(400).json({ erro: 'Quantidade inválida' });
    }

    const produtos = store.getAll();
    const indice = produtos.findIndex((p) => p.id === req.params.id);
    if (indice === -1) {
        return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    const produto = produtos[indice];
    const atualizado = { ...produto, estoque: produto.estoque + quantidade };
    const novaLista = produtos.map((p, i) => (i === indice ? atualizado : p));
    await store.save(novaLista);

    res.json({ id: atualizado.id, estoque: atualizado.estoque });
});

if (require.main === module) {
    prontidao
        .then(() => {
            app.listen(PORT, '0.0.0.0', () => {
                console.log(`Serviço_Produtos executando na porta ${PORT}`);
            });
        })
        .catch(() => {
            process.exit(1);
        });
}

module.exports = app;
module.exports.store = store;
module.exports.prontidao = prontidao;
