// Cliente REST para o Serviço_Produtos (produtosClient.js)
//
// Encapsula as chamadas HTTP que o Serviço_Pedidos faz ao Serviço_Produtos,
// mantendo-as num único módulo para que:
//  - a URL base venha da variável de ambiente PRODUTOS_URL (Requisito 12.5),
//    com fallback para o nome de serviço na Rede_Docker
//    (`http://produtos:3001`);
//  - os testes possam mockar o `global.fetch` que estas funções usam;
//  - a tarefa 8.1 possa, mais tarde, substituir o fetch direto por um cliente
//    resiliente com retry/backoff sem alterar os chamadores.
//
// Formato das respostas esperadas do Serviço_Produtos:
//   GET  /produtos/:id           -> 200 { id, nome, preco, estoque, atributos, ... } | 404
//   GET  /produtos/:id/estoque   -> 200 { id, estoque } | 404
//   POST /produtos/:id/reservar  -> 200 { ... } | 409 { erro } | 404
//   POST /produtos/:id/devolver  -> 200 { ... } | 404
//
// A URL base é lida a cada chamada (via getBaseUrl) para permitir override em
// tempo de execução nos testes locais. Node 18+ fornece `fetch` global.
//
// As chamadas passam pelo cliente HTTP resiliente (`httpClient.fetchComRetry`),
// que aplica retry/backoff curto para erros de conexão e 5xx, cobrindo a
// resiliência à ordem de inicialização sem derrubar o processo. (Tarefa 8.1,
// Requisitos 10.1, 10.3, 10.4, 12.6)

const { fetchComRetry } = require('./httpClient');

/**
 * Resolve a URL base do Serviço_Produtos a partir do ambiente.
 * Lida a cada chamada para permitir override em testes locais.
 *
 * @returns {string}
 */
function getBaseUrl() {
    return process.env.PRODUTOS_URL || 'http://produtos:3001';
}

/**
 * Remove uma eventual barra final da URL base para compor caminhos de forma
 * previsível.
 *
 * @param {string} base
 * @returns {string}
 */
function normalizarBase(base) {
    return typeof base === 'string' ? base.replace(/\/+$/, '') : '';
}

/**
 * Erro específico de indisponibilidade do Serviço_Produtos (falha de rede).
 * Os chamadores traduzem isto em uma resposta 503 amigável. A resiliência com
 * retry/backoff é adicionada na tarefa 8.1.
 */
class ProdutosIndisponivelError extends Error {
    constructor(message) {
        super(message || 'Serviço de produtos indisponível');
        this.name = 'ProdutosIndisponivelError';
    }
}

/**
 * Consulta um produto por id no Serviço_Produtos. Usado para revalidar
 * existência, preço e atributos ao criar o pedido. (Requisito 6.2)
 *
 * @param {string} produtoId
 * @returns {Promise<{ encontrado: boolean, produto?: object }>}
 * @throws {ProdutosIndisponivelError} se a chamada de rede falhar.
 */
async function obterProduto(produtoId) {
    const url = `${normalizarBase(getBaseUrl())}/produtos/${encodeURIComponent(produtoId)}`;
    let resposta;
    try {
        resposta = await fetchComRetry(url);
    } catch (err) {
        throw new ProdutosIndisponivelError(err && err.message);
    }
    if (resposta.status === 404) {
        return { encontrado: false };
    }
    if (!resposta.ok) {
        throw new ProdutosIndisponivelError(
            `Resposta inesperada do Serviço_Produtos: ${resposta.status}`
        );
    }
    const produto = await resposta.json();
    return { encontrado: true, produto };
}

/**
 * Consulta a quantidade em estoque de um produto. (Requisito 6.2)
 *
 * @param {string} produtoId
 * @returns {Promise<{ encontrado: boolean, estoque?: number }>}
 * @throws {ProdutosIndisponivelError} se a chamada de rede falhar.
 */
async function obterEstoque(produtoId) {
    const url = `${normalizarBase(getBaseUrl())}/produtos/${encodeURIComponent(produtoId)}/estoque`;
    let resposta;
    try {
        resposta = await fetchComRetry(url);
    } catch (err) {
        throw new ProdutosIndisponivelError(err && err.message);
    }
    if (resposta.status === 404) {
        return { encontrado: false };
    }
    if (!resposta.ok) {
        throw new ProdutosIndisponivelError(
            `Resposta inesperada do Serviço_Produtos: ${resposta.status}`
        );
    }
    const corpo = await resposta.json();
    return { encontrado: true, estoque: corpo.estoque };
}

/**
 * Solicita a reserva (redução) de `quantidade` do estoque de um produto.
 * (Requisitos 6.3, 2.2, 2.3)
 *
 * @param {string} produtoId
 * @param {number} quantidade
 * @returns {Promise<{ ok: boolean, encontrado: boolean, estoqueInsuficiente: boolean, produto?: object }>}
 *   - `ok: true` quando a reserva foi efetuada (200);
 *   - `encontrado: false` quando o produto não existe (404);
 *   - `estoqueInsuficiente: true` quando o catálogo recusa por estoque (409).
 * @throws {ProdutosIndisponivelError} se a chamada de rede falhar.
 */
async function reservar(produtoId, quantidade) {
    const url = `${normalizarBase(getBaseUrl())}/produtos/${encodeURIComponent(produtoId)}/reservar`;
    let resposta;
    try {
        resposta = await fetchComRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantidade })
        });
    } catch (err) {
        throw new ProdutosIndisponivelError(err && err.message);
    }
    if (resposta.status === 404) {
        return { ok: false, encontrado: false, estoqueInsuficiente: false };
    }
    if (resposta.status === 409) {
        return { ok: false, encontrado: true, estoqueInsuficiente: true };
    }
    if (!resposta.ok) {
        throw new ProdutosIndisponivelError(
            `Resposta inesperada do Serviço_Produtos: ${resposta.status}`
        );
    }
    const produto = await resposta.json().catch(() => undefined);
    return { ok: true, encontrado: true, estoqueInsuficiente: false, produto };
}

/**
 * Solicita a devolução (aumento) de `quantidade` ao estoque de um produto.
 * Usado para compensar reservas em caso de falha parcial e no pagamento
 * recusado (tarefa 6.6, Requisitos 2.4, 7.4).
 *
 * @param {string} produtoId
 * @param {number} quantidade
 * @returns {Promise<{ ok: boolean, encontrado: boolean, produto?: object }>}
 * @throws {ProdutosIndisponivelError} se a chamada de rede falhar.
 */
async function devolver(produtoId, quantidade) {
    const url = `${normalizarBase(getBaseUrl())}/produtos/${encodeURIComponent(produtoId)}/devolver`;
    let resposta;
    try {
        resposta = await fetchComRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantidade })
        });
    } catch (err) {
        throw new ProdutosIndisponivelError(err && err.message);
    }
    if (resposta.status === 404) {
        return { ok: false, encontrado: false };
    }
    if (!resposta.ok) {
        throw new ProdutosIndisponivelError(
            `Resposta inesperada do Serviço_Produtos: ${resposta.status}`
        );
    }
    const produto = await resposta.json().catch(() => undefined);
    return { ok: true, encontrado: true, produto };
}

module.exports = {
    getBaseUrl,
    obterProduto,
    obterEstoque,
    reservar,
    devolver,
    ProdutosIndisponivelError
};
