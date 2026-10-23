// Cliente REST para o Serviço_Carrinho (carrinhoClient.js)
//
// Encapsula as chamadas HTTP que o Serviço_Pedidos faz ao Serviço_Carrinho,
// mantendo-as num único módulo para que:
//  - a URL base venha da variável de ambiente CARRINHO_URL (Requisito 12.5),
//    com fallback para o nome de serviço na Rede_Docker
//    (`http://carrinho:3002`);
//  - os testes possam mockar o `global.fetch` que estas funções usam;
//  - a tarefa 8.1 possa, mais tarde, substituir o fetch direto por um cliente
//    resiliente com retry/backoff sem alterar os chamadores.
//
// Formato das respostas esperadas do Serviço_Carrinho:
//   GET    /carrinho/:id        -> 200 { id, itens, cep, frete, subtotal, total } | 404
//   DELETE /carrinho/:id/itens  -> 200 { ... } | 404
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
 * Resolve a URL base do Serviço_Carrinho a partir do ambiente.
 * Lida a cada chamada para permitir override em testes locais.
 *
 * @returns {string}
 */
function getBaseUrl() {
    return process.env.CARRINHO_URL || 'http://carrinho:3002';
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
 * Erro específico de indisponibilidade do Serviço_Carrinho (falha de rede).
 * Os chamadores traduzem isto em uma resposta 503 amigável. A resiliência com
 * retry/backoff é adicionada na tarefa 8.1.
 */
class CarrinhoIndisponivelError extends Error {
    constructor(message) {
        super(message || 'Serviço de carrinho indisponível');
        this.name = 'CarrinhoIndisponivelError';
    }
}

/**
 * Consulta um carrinho por id no Serviço_Carrinho, retornando itens e valores
 * (subtotal, frete, total, cep) já recalculados pelo serviço. (Requisito 6.1)
 *
 * @param {string} carrinhoId
 * @returns {Promise<{ encontrado: boolean, carrinho?: object }>}
 *   `encontrado: false` quando o serviço responde 404; `carrinho` com os
 *   dados quando 200.
 * @throws {CarrinhoIndisponivelError} se a chamada de rede falhar.
 */
async function obterCarrinho(carrinhoId) {
    const url = `${normalizarBase(getBaseUrl())}/carrinho/${encodeURIComponent(carrinhoId)}`;
    let resposta;
    try {
        resposta = await fetchComRetry(url);
    } catch (err) {
        throw new CarrinhoIndisponivelError(err && err.message);
    }
    if (resposta.status === 404) {
        return { encontrado: false };
    }
    if (!resposta.ok) {
        throw new CarrinhoIndisponivelError(
            `Resposta inesperada do Serviço_Carrinho: ${resposta.status}`
        );
    }
    const carrinho = await resposta.json();
    return { encontrado: true, carrinho };
}

/**
 * Solicita a limpeza de todos os itens de um carrinho. Usado após o pagamento
 * aprovado (tarefa 6.6, Requisito 7.2). Incluído aqui para reaproveitamento.
 *
 * @param {string} carrinhoId
 * @returns {Promise<{ encontrado: boolean }>}
 * @throws {CarrinhoIndisponivelError} se a chamada de rede falhar.
 */
async function limparItens(carrinhoId) {
    const url = `${normalizarBase(getBaseUrl())}/carrinho/${encodeURIComponent(carrinhoId)}/itens`;
    let resposta;
    try {
        resposta = await fetchComRetry(url, { method: 'DELETE' });
    } catch (err) {
        throw new CarrinhoIndisponivelError(err && err.message);
    }
    if (resposta.status === 404) {
        return { encontrado: false };
    }
    if (!resposta.ok) {
        throw new CarrinhoIndisponivelError(
            `Resposta inesperada do Serviço_Carrinho: ${resposta.status}`
        );
    }
    return { encontrado: true };
}

module.exports = {
    getBaseUrl,
    obterCarrinho,
    limparItens,
    CarrinhoIndisponivelError
};
