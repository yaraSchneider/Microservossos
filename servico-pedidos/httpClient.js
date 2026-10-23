// Cliente HTTP resiliente entre serviços (httpClient.js)
//
// Módulo replicado por serviço (como store.js). Centraliza as chamadas REST
// entre serviços aplicando retry/backoff para erros transitórios, de modo que
// a ordem de inicialização dos contêineres não derrube o processo requisitante
// e que indisponibilidades momentâneas sejam toleradas. (Requisitos 10.1,
// 10.3, 10.4, 12.6)
//
// Política de retry:
//  - Repete quando o `fetch` lança (erro de conexão: ECONNREFUSED, timeout,
//    DNS, etc.) OU quando a resposta é 5xx (indisponibilidade do dependente).
//  - NÃO repete em respostas 4xx (404/409/400 são definitivas).
//  - Esgotadas as tentativas numa falha de conexão, relança o último erro para
//    que o chamador o traduza num 503 amigável. Nunca derruba o processo.
//
// Node 18+ fornece `fetch` global.

/**
 * Aguarda `ms` milissegundos.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa `fetch(url, options)` com retry e backoff para erros transitórios.
 *
 * Repete em:
 *  - exceção lançada pelo `fetch` (falha de conexão/timeout);
 *  - resposta com status 5xx (serviço dependente indisponível).
 *
 * Não repete em respostas 4xx (definitivas). Em caso de 5xx persistente,
 * retorna a última resposta recebida para o chamador decidir. Em caso de falha
 * de conexão persistente, relança o último erro.
 *
 * @param {string} url
 * @param {object} [options] Opções repassadas ao `fetch`.
 * @param {{ tentativas?: number, backoffMs?: number }} [config]
 *   `tentativas` é o total de tentativas (>= 1); `backoffMs` é o atraso base
 *   (exponencial curto entre tentativas).
 * @returns {Promise<Response>}
 */
async function fetchComRetry(url, options, config = {}) {
    const tentativas = Math.max(1, config.tentativas ?? 3);
    const backoffMs = config.backoffMs ?? 100;

    let ultimoErro;
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
        let resposta;
        try {
            resposta = await fetch(url, options);
        } catch (err) {
            // Falha de conexão (ECONNREFUSED, timeout, DNS): candidata a retry.
            ultimoErro = err;
            if (tentativa < tentativas) {
                await esperar(backoffMs * tentativa);
                continue;
            }
            // Esgotadas as tentativas: relança para o chamador traduzir em 503.
            throw err;
        }

        // 5xx indica indisponibilidade do dependente: vale tentar de novo.
        if (resposta.status >= 500 && tentativa < tentativas) {
            await esperar(backoffMs * tentativa);
            continue;
        }

        // 2xx, 3xx ou 4xx (definitivas), ou último 5xx: devolve ao chamador.
        return resposta;
    }

    // Inalcançável em condições normais; preserva o último erro por segurança.
    throw ultimoErro || new Error('fetchComRetry: falha inesperada');
}

module.exports = { fetchComRetry };
