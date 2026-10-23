// Modelo de Carrinho e Item_Carrinho (carrinho.js)
//
// Módulo puro e testável do Serviço_Carrinho. Não contém rotas Express — o
// CRUD HTTP é implementado no server.js (tarefas 4.1+). Aqui ficam a estrutura
// do Carrinho, a geração de id único e os campos derivados de valores.
//
// Estrutura do Carrinho (Modelos de Dados > Carrinho e Item_Carrinho):
//  {
//    id: "c-9f8e7d",               // identificador único, prefixo "c-"
//    itens: [                      // Item_Carrinho[]
//      { produtoId: "p-ab12cd", quantidade: 2, precoUnitario: 350000 }
//    ],
//    cep: null,                    // CEP normalizado (null quando ausente)
//    frete: 0,                     // centavos (0 quando não calculado)
//    subtotal: 0,                  // centavos (soma precoUnitario*quantidade)
//    total: 0                      // centavos (subtotal + frete)
//  }
//
// Observações de escopo (tarefa 4.1):
//  - Esta tarefa cria apenas o carrinho vazio e o CRUD básico.
//  - O cálculo de subtotal/total é da tarefa 4.2; a gestão de itens com
//    integração ao Serviço_Produtos é da tarefa 4.4; o frete por CEP é da
//    tarefa 4.6. Aqui os campos subtotal/frete/total apenas existem com
//    valores padrão 0 para manter a forma do modelo.
const crypto = require('crypto');

/**
 * Gera um identificador único para um Carrinho, no formato "c-xxxxxx".
 * Espelha o esquema de ids do Serviço_Produtos ("p-"), com 3 bytes -> 6
 * caracteres hexadecimais.
 *
 * @returns {string}
 */
function gerarId() {
    return 'c-' + crypto.randomBytes(3).toString('hex');
}

/**
 * Constrói um novo Carrinho vazio com id único.
 *
 * Carrinho recém-criado: `itens` vazio, `cep` null, `frete` 0, `subtotal` 0
 * e `total` 0. (Requisitos 3.1, 9.1)
 *
 * @param {{ id?: string }} [opcoes] Permite injetar um id (ex.: em testes).
 * @returns {{ id: string, itens: Array, cep: null, frete: number, subtotal: number, total: number }}
 */
function criarCarrinho(opcoes = {}) {
    const id =
        typeof opcoes.id === 'string' && opcoes.id.length > 0
            ? opcoes.id
            : gerarId();
    return {
        id,
        itens: [],
        cep: null,
        frete: 0,
        subtotal: 0,
        total: 0
    };
}

/**
 * Calcula o Subtotal de uma lista de Itens_Carrinho.
 *
 * Subtotal = soma de `precoUnitario * quantidade` de cada item, em centavos
 * (inteiros). Itens ausentes/indefinidos ou lista vazia resultam em 0.
 * (Requisito 5.1)
 *
 * @param {Array<{ precoUnitario?: number, quantidade?: number }>} [itens]
 * @returns {number} Subtotal em centavos (inteiro).
 */
function calcularSubtotal(itens) {
    if (!Array.isArray(itens) || itens.length === 0) {
        return 0;
    }
    return itens.reduce((soma, item) => {
        const preco = Number(item && item.precoUnitario) || 0;
        const quantidade = Number(item && item.quantidade) || 0;
        return soma + preco * quantidade;
    }, 0);
}

/**
 * Recalcula os valores derivados de um Carrinho (subtotal e total).
 *
 * `subtotal` é recomputado a partir dos itens (fonte da verdade). `total` é
 * `subtotal + frete`, tratando frete ausente/não calculado como 0.
 * (Requisitos 5.1, 5.2, 5.3)
 *
 * Retorna uma nova referência de carrinho com os campos atualizados, sem
 * mutar o carrinho original.
 *
 * @param {{ frete?: number, itens?: Array }} carrinho
 * @returns {object} Carrinho com `subtotal` e `total` recalculados.
 */
function calcularValores(carrinho) {
    const base = carrinho || {};
    const subtotal = calcularSubtotal(base.itens);
    const frete = Number(base.frete) || 0;
    return {
        ...base,
        subtotal,
        total: subtotal + frete
    };
}

module.exports = {
    criarCarrinho,
    gerarId,
    calcularSubtotal,
    calcularValores
};
