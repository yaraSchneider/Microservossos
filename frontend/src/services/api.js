// ---------------------------------------------------------------------------
// Cliente de API do Frontend
//
// Todas as chamadas usam caminhos RELATIVOS `/api/...`. O proxy do Vite (dev)
// ou o nginx (produção) encaminha cada prefixo ao backend correto na Rede
// Docker. O navegador nunca conhece os nomes internos dos contêineres nem
// lida com CORS. (Requisito 10.2)
//
// Convenção de prefixos (ver vite.config.js):
//   /api/produtos -> Serviço_Produtos (3001)  [rewrite -> /produtos]
//   /api/carrinho -> Serviço_Carrinho (3002)  [rewrite -> /carrinho]
//   /api/pedidos  -> Serviço_Pedidos  (3003)  [rewrite -> /pedidos]
//
// Em caso de falha, o backend responde `{ erro: "..." }`. Este cliente
// extrai essa mensagem e lança um Error, permitindo que as telas exibam
// mensagens amigáveis.
// ---------------------------------------------------------------------------

/**
 * Executa uma requisição fetch e trata a resposta de forma consistente.
 * - Lança Error com a mensagem `{ erro }` do backend quando a resposta não é ok.
 * - Retorna o JSON parseado quando há corpo; `undefined` para 204/sem corpo.
 *
 * @param {string} caminho Caminho relativo iniciando em `/api/...`.
 * @param {RequestInit} [opcoes] Opções do fetch (method, body, headers...).
 * @returns {Promise<any>}
 */
async function requisitar(caminho, opcoes = {}) {
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...opcoes,
    };

    let resposta;
    try {
        resposta = await fetch(caminho, config);
    } catch {
        // Falha de rede (serviço fora do ar, proxy indisponível, etc.).
        throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
    }

    // 204 No Content (ex.: DELETE /produtos/:id) não tem corpo para parsear.
    if (resposta.status === 204) {
        if (!resposta.ok) {
            throw new Error('Ocorreu um erro ao processar a requisição.');
        }
        return undefined;
    }

    let dados;
    const texto = await resposta.text();
    if (texto) {
        try {
            dados = JSON.parse(texto);
        } catch {
            dados = undefined;
        }
    }

    if (!resposta.ok) {
        const mensagem =
            (dados && dados.erro) || 'Ocorreu um erro ao processar a requisição.';
        throw new Error(mensagem);
    }

    return dados;
}

/** Monta o body JSON de forma segura. */
function corpo(dados) {
    return JSON.stringify(dados);
}

// ---------------------------------------------------------------------------
// Serviço_Produtos — catálogo e estoque
// ---------------------------------------------------------------------------
export const produtos = {
    /** GET /api/produtos — lista todos os produtos. */
    listar: () => requisitar('/api/produtos'),

    /** GET /api/produtos/:id — obtém um produto. */
    obter: (id) => requisitar(`/api/produtos/${encodeURIComponent(id)}`),

    /** POST /api/produtos — cria um produto. */
    criar: (dados) =>
        requisitar('/api/produtos', { method: 'POST', body: corpo(dados) }),

    /** PUT /api/produtos/:id — atualiza um produto. */
    atualizar: (id, dados) =>
        requisitar(`/api/produtos/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: corpo(dados),
        }),

    /** DELETE /api/produtos/:id — remove um produto (204). */
    remover: (id) =>
        requisitar(`/api/produtos/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    /** GET /api/produtos/:id/estoque — consulta o estoque disponível. */
    estoque: (id) =>
        requisitar(`/api/produtos/${encodeURIComponent(id)}/estoque`),
};

// ---------------------------------------------------------------------------
// Serviço_Carrinho — carrinho, itens e frete
// ---------------------------------------------------------------------------
export const carrinho = {
    /** POST /api/carrinho — cria um carrinho vazio. */
    criar: () => requisitar('/api/carrinho', { method: 'POST' }),

    /** GET /api/carrinho/:id — obtém o carrinho com subtotal/frete/total. */
    obter: (id) => requisitar(`/api/carrinho/${encodeURIComponent(id)}`),

    /** POST /api/carrinho/:id/itens — adiciona um item { produtoId, quantidade }. */
    adicionarItem: (id, { produtoId, quantidade }) =>
        requisitar(`/api/carrinho/${encodeURIComponent(id)}/itens`, {
            method: 'POST',
            body: corpo({ produtoId, quantidade }),
        }),

    /** PUT /api/carrinho/:id/itens/:produtoId — altera a quantidade { quantidade }. */
    alterarItem: (id, produtoId, { quantidade }) =>
        requisitar(
            `/api/carrinho/${encodeURIComponent(id)}/itens/${encodeURIComponent(produtoId)}`,
            { method: 'PUT', body: corpo({ quantidade }) }
        ),

    /** DELETE /api/carrinho/:id/itens/:produtoId — remove um item. */
    removerItem: (id, produtoId) =>
        requisitar(
            `/api/carrinho/${encodeURIComponent(id)}/itens/${encodeURIComponent(produtoId)}`,
            { method: 'DELETE' }
        ),

    /** DELETE /api/carrinho/:id/itens — limpa todos os itens. */
    limpar: (id) =>
        requisitar(`/api/carrinho/${encodeURIComponent(id)}/itens`, {
            method: 'DELETE',
        }),

    /** POST /api/carrinho/:id/frete — calcula o frete { cep }. */
    calcularFrete: (id, { cep }) =>
        requisitar(`/api/carrinho/${encodeURIComponent(id)}/frete`, {
            method: 'POST',
            body: corpo({ cep }),
        }),
};

// ---------------------------------------------------------------------------
// Serviço_Pedidos — pedidos e pagamento simulado
// ---------------------------------------------------------------------------
export const pedidos = {
    /** GET /api/pedidos — lista o histórico de pedidos. */
    listar: () => requisitar('/api/pedidos'),

    /** GET /api/pedidos/:id — obtém o pedido completo com snapshot. */
    obter: (id) => requisitar(`/api/pedidos/${encodeURIComponent(id)}`),

    /** POST /api/pedidos — finaliza a compra { carrinhoId, comprador }. */
    criar: ({ carrinhoId, comprador }) =>
        requisitar('/api/pedidos', {
            method: 'POST',
            body: corpo({ carrinhoId, comprador }),
        }),

    /** POST /api/pedidos/:id/pagamento — pagamento simulado { aprovado }. */
    pagar: (id, { aprovado }) =>
        requisitar(`/api/pedidos/${encodeURIComponent(id)}/pagamento`, {
            method: 'POST',
            body: corpo({ aprovado }),
        }),
};

export default { produtos, carrinho, pedidos };
