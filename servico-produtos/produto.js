// Modelo de Produto e validação (produto.js)
//
// Módulo puro e testável do Serviço_Produtos. Não contém rotas Express — o
// CRUD HTTP é implementado na tarefa 2.3. Aqui ficam apenas a estrutura do
// Produto, a validação da entrada e a construção de um novo Produto com id
// único e mapa de atributos normalizado.
//
// Estrutura do Produto (Modelos de Dados > Produto):
//  {
//    id: "p-ab12cd",            // identificador único, prefixo "p-"
//    nome: "Notebook",          // string não vazia
//    descricao: "...",          // string (opcional, default "")
//    categoria: "Eletrônicos",  // string (opcional, default "")
//    preco: 350000,             // inteiro >= 0 (centavos)
//    estoque: 12,               // inteiro >= 0
//    imagemUrl: "https://...",  // string opcional (default "")
//    atributos: { cor: "prata" }// mapa dinâmico chave-valor (default {})
//  }
//
// Preço e estoque são sempre inteiros não negativos (Requisitos 1.2, 1.8).
// Validação (Requisito 1.9): nome não vazio; preço inteiro >= 0; estoque
// inteiro >= 0. Em falha, retorna erro adequado a uma resposta 400.
const crypto = require('crypto');

/**
 * Verifica se um valor é um inteiro não negativo "limpo".
 * Rejeita strings, NaN, Infinity, floats e números negativos.
 *
 * @param {unknown} valor
 * @returns {boolean}
 */
function isInteiroNaoNegativo(valor) {
    return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0;
}

/**
 * Normaliza o mapa de atributos personalizados em um objeto de pares
 * chave-valor. Entradas ausentes/invalidas resultam em `{}`. Cada valor é
 * convertido para string, refletindo o armazenamento como par chave-valor.
 *
 * @param {unknown} atributos
 * @returns {Record<string, string>}
 */
function normalizarAtributos(atributos) {
    const resultado = {};
    if (
        atributos == null ||
        typeof atributos !== 'object' ||
        Array.isArray(atributos)
    ) {
        return resultado;
    }
    for (const [chave, valor] of Object.entries(atributos)) {
        // Ignora valores nulos/indefinidos; demais viram string.
        if (valor == null) continue;
        resultado[String(chave)] = String(valor);
    }
    return resultado;
}

/**
 * Gera um identificador único para um Produto, no formato "p-xxxxxx".
 *
 * @returns {string}
 */
function gerarId() {
    // 3 bytes -> 6 caracteres hexadecimais; prefixo "p-" conforme o design.
    return 'p-' + crypto.randomBytes(3).toString('hex');
}

/**
 * Valida a entrada de um Produto (cadastro ou edição) e retorna um objeto de
 * produto normalizado ou um erro de validação descritivo.
 *
 * Regras (Requisito 1.9):
 *  - `nome` não vazio (string com conteúdo após trim);
 *  - `preco` inteiro >= 0 (centavos);
 *  - `estoque` inteiro >= 0.
 *
 * @param {unknown} entrada Corpo da requisição.
 * @returns {{ valido: true, produto: object } | { valido: false, erro: string }}
 */
function validarProduto(entrada) {
    if (entrada == null || typeof entrada !== 'object' || Array.isArray(entrada)) {
        return { valido: false, erro: 'Dados do produto inválidos' };
    }

    const { nome, descricao, categoria, preco, estoque, imagemUrl, atributos } =
        entrada;

    // Nome não vazio.
    if (typeof nome !== 'string' || nome.trim() === '') {
        return { valido: false, erro: 'Nome é obrigatório' };
    }

    // Preço inteiro não negativo (centavos).
    if (!isInteiroNaoNegativo(preco)) {
        return { valido: false, erro: 'Preço inválido' };
    }

    // Estoque inteiro não negativo.
    if (!isInteiroNaoNegativo(estoque)) {
        return { valido: false, erro: 'Estoque não pode ser negativo' };
    }

    const produto = {
        nome: nome.trim(),
        descricao: typeof descricao === 'string' ? descricao : '',
        categoria: typeof categoria === 'string' ? categoria : '',
        preco,
        estoque,
        imagemUrl: typeof imagemUrl === 'string' ? imagemUrl : '',
        atributos: normalizarAtributos(atributos)
    };

    return { valido: true, produto };
}

/**
 * Constrói um novo Produto a partir de uma entrada válida, atribuindo um id
 * único. Valida a entrada internamente; se inválida, retorna o erro de
 * validação (nenhum produto é criado).
 *
 * @param {unknown} entrada Corpo da requisição.
 * @param {{ id?: string }} [opcoes] Permite injetar um id (ex.: em testes).
 * @returns {{ valido: true, produto: object } | { valido: false, erro: string }}
 */
function criarProduto(entrada, opcoes = {}) {
    const resultado = validarProduto(entrada);
    if (!resultado.valido) {
        return resultado;
    }
    const id = typeof opcoes.id === 'string' && opcoes.id.length > 0
        ? opcoes.id
        : gerarId();
    return { valido: true, produto: { id, ...resultado.produto } };
}

module.exports = {
    validarProduto,
    criarProduto,
    normalizarAtributos,
    gerarId,
    isInteiroNaoNegativo
};
