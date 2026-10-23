// Modelo de Pedido (pedido.js)
//
// Módulo puro e testável do Serviço_Pedidos. Não contém rotas Express — o
// CRUD HTTP é implementado no server.js (tarefas 6.x). Aqui ficam a estrutura
// do Pedido, as constantes de status, a geração de id único e o helper de
// construção de um Pedido a partir de dados já validados.
//
// Estrutura do Pedido (Modelos de Dados > Pedido):
//  {
//    id: "o-1a2b3c",               // identificador único, prefixo "o-"
//    carrinhoId: "c-9f8e7d",       // carrinho de origem
//    chaveIdempotencia: "c-9f8e7d",// chave de idempotência da finalização
//    comprador: {                  // dados de entrega informados pelo usuário
//      nome, cep, endereco, numero, complemento?
//    },
//    itens: [                      // Snapshot imutável (Requisitos 6.4, 6.7, 7.7)
//      { produtoId, nome, precoUnitario, quantidade, atributos }
//    ],
//    subtotal: 700000,             // centavos
//    frete: 0,                     // centavos
//    total: 700000,                // centavos (subtotal + frete)
//    status: "PENDENTE",           // PENDENTE | PAGO | PAGAMENTO_RECUSADO | CANCELADO
//    data: "2024-01-01T12:00:00.000Z" // ISO 8601
//  }
//
// Observações de escopo (tarefa 6.1):
//  - Este módulo apenas CONSTRÓI o objeto Pedido a partir de entradas já
//    validadas. O fluxo completo de criação (consultar carrinho, revalidar e
//    reservar estoque, idempotência, pagamento) é das tarefas 6.2/6.3/6.6.
const crypto = require('crypto');

/**
 * Valores possíveis de status de um Pedido. (Requisito 7.5)
 */
const STATUS = Object.freeze({
    PENDENTE: 'PENDENTE',
    PAGO: 'PAGO',
    PAGAMENTO_RECUSADO: 'PAGAMENTO_RECUSADO',
    CANCELADO: 'CANCELADO'
});

/**
 * Conjunto dos status válidos, útil para validações.
 * @type {ReadonlySet<string>}
 */
const STATUS_VALIDOS = Object.freeze(new Set(Object.values(STATUS)));

/**
 * Gera um identificador único para um Pedido, no formato "o-xxxxxx".
 * Espelha o esquema de ids dos demais serviços ("p-", "c-"), com 3 bytes ->
 * 6 caracteres hexadecimais via crypto.randomBytes.
 *
 * @returns {string}
 */
function gerarId() {
    return 'o-' + crypto.randomBytes(3).toString('hex');
}

/**
 * Normaliza os dados do comprador para a forma gravada no Pedido.
 * `complemento` é opcional: quando ausente, é armazenado como string vazia.
 *
 * @param {{ nome?: string, cep?: string, endereco?: string, numero?: string, complemento?: string }} [comprador]
 * @returns {{ nome: string, cep: string, endereco: string, numero: string, complemento: string }}
 */
function normalizarComprador(comprador = {}) {
    return {
        nome: comprador.nome,
        cep: comprador.cep,
        endereco: comprador.endereco,
        numero: comprador.numero,
        complemento:
            comprador.complemento == null ? '' : comprador.complemento
    };
}

/**
 * Constrói um snapshot imutável dos itens, preservando apenas os campos do
 * modelo de Pedido (produtoId, nome, precoUnitario, quantidade, atributos).
 *
 * @param {Array<object>} [itens]
 * @returns {Array<{ produtoId: string, nome: string, precoUnitario: number, quantidade: number, atributos: object }>}
 */
function montarSnapshotItens(itens) {
    if (!Array.isArray(itens)) {
        return [];
    }
    return itens.map((item) => ({
        produtoId: item.produtoId,
        nome: item.nome,
        precoUnitario: item.precoUnitario,
        quantidade: item.quantidade,
        atributos:
            item.atributos && typeof item.atributos === 'object'
                ? { ...item.atributos }
                : {}
    }));
}

/**
 * Constrói um novo Pedido a partir de dados JÁ VALIDADOS.
 *
 * Este helper não faz chamadas de rede nem validação de negócio — apenas monta
 * o objeto Pedido com id único, snapshot imutável dos itens, dados do comprador
 * e valores. O status padrão é PENDENTE e `data` é o instante de criação (ISO).
 * (Requisitos 6.4, 6.7, 8.2)
 *
 * @param {object} dados
 * @param {string} dados.carrinhoId Carrinho de origem.
 * @param {string} [dados.chaveIdempotencia] Chave de idempotência (padrão: carrinhoId).
 * @param {object} dados.comprador Dados de entrega.
 * @param {Array<object>} dados.itens Itens a congelar no snapshot.
 * @param {number} dados.subtotal Subtotal em centavos.
 * @param {number} [dados.frete=0] Frete em centavos.
 * @param {number} [dados.total] Total em centavos (padrão: subtotal + frete).
 * @param {string} [dados.status=PENDENTE] Status inicial.
 * @param {string} [dados.id] Permite injetar um id (ex.: em testes).
 * @param {string} [dados.data] Permite injetar a data (ex.: em testes).
 * @returns {object} Pedido.
 */
function criarPedido(dados = {}) {
    const id =
        typeof dados.id === 'string' && dados.id.length > 0
            ? dados.id
            : gerarId();

    const subtotal = Number(dados.subtotal) || 0;
    const frete = Number(dados.frete) || 0;
    const total =
        dados.total == null ? subtotal + frete : Number(dados.total) || 0;

    const chaveIdempotencia =
        typeof dados.chaveIdempotencia === 'string' &&
        dados.chaveIdempotencia.length > 0
            ? dados.chaveIdempotencia
            : dados.carrinhoId;

    return {
        id,
        carrinhoId: dados.carrinhoId,
        chaveIdempotencia,
        comprador: normalizarComprador(dados.comprador),
        itens: montarSnapshotItens(dados.itens),
        subtotal,
        frete,
        total,
        status: dados.status || STATUS.PENDENTE,
        data:
            typeof dados.data === 'string' && dados.data.length > 0
                ? dados.data
                : new Date().toISOString()
    };
}

module.exports = {
    STATUS,
    STATUS_VALIDOS,
    gerarId,
    criarPedido
};
