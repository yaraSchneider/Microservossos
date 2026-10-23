// Cálculo de frete por CEP (frete.js)
//
// Módulo puro e determinístico do Serviço_Carrinho. Sem dependências de rede
// ou de Express — a rota HTTP POST /carrinho/:id/frete vive em server.js e usa
// estas funções. Ser puro permite que os testes de propriedade (Prop. 5 e 6)
// exercitem a lógica diretamente.
//
// Regras (design > "Cálculo de frete por CEP", Requisito 4):
//  1. Normaliza o CEP removendo hífen e espaços; deve conter EXATAMENTE 8
//     dígitos, senão é inválido (Requisitos 4.6, 4.7).
//  2. Frete base pelo primeiro dígito: 0–3 → 1500, 4–6 → 2500, 7–9 → 3500
//     centavos (Requisitos 4.2, 4.3, 4.4).
//  3. Se subtotal > 50000 centavos, frete grátis (0), sobrepondo a regra do
//     CEP (Requisito 4.5).

const FRETE_FAIXA_BAIXA = 1500; // primeiro dígito 0–3
const FRETE_FAIXA_MEDIA = 2500; // primeiro dígito 4–6
const FRETE_FAIXA_ALTA = 3500; // primeiro dígito 7–9
const LIMITE_FRETE_GRATIS = 50000; // subtotal acima disso → frete grátis

/**
 * Normaliza um CEP removendo hífens e espaços (qualquer caractere que não seja
 * dígito é descartado), retornando apenas a sequência de dígitos.
 *
 * Não valida o tamanho — use cepValido para isso. Entradas não-string
 * resultam em string vazia.
 *
 * @param {unknown} cep
 * @returns {string} Apenas os dígitos do CEP.
 */
function normalizarCep(cep) {
    if (typeof cep !== 'string') {
        return '';
    }
    return cep.replace(/\D/g, '');
}

/**
 * Indica se um CEP é válido: após normalização, deve conter exatamente 8
 * dígitos. (Requisitos 4.6, 4.7)
 *
 * @param {unknown} cep
 * @returns {boolean}
 */
function cepValido(cep) {
    return normalizarCep(cep).length === 8;
}

/**
 * Calcula o frete (em centavos) a partir do CEP e do subtotal do carrinho.
 *
 * Determinístico: a presença/ausência de hífen ou espaços não altera o
 * resultado, pois o CEP é normalizado antes de inspecionar o primeiro dígito.
 * Se o subtotal exceder o limite de frete grátis, retorna 0 independentemente
 * do CEP. (Requisitos 4.1–4.5)
 *
 * @param {string} cep CEP (com ou sem hífen/espaços); deve ser válido.
 * @param {number} subtotal Subtotal do carrinho em centavos.
 * @returns {number} Frete em centavos.
 * @throws {Error} Se o CEP não for válido (exatamente 8 dígitos).
 */
function calcularFrete(cep, subtotal) {
    const normalizado = normalizarCep(cep);
    if (normalizado.length !== 8) {
        throw new Error('CEP inválido');
    }

    // Frete grátis sobrepõe a regra do CEP.
    if (Number(subtotal) > LIMITE_FRETE_GRATIS) {
        return 0;
    }

    const primeiroDigito = Number(normalizado[0]);
    if (primeiroDigito <= 3) {
        return FRETE_FAIXA_BAIXA;
    }
    if (primeiroDigito <= 6) {
        return FRETE_FAIXA_MEDIA;
    }
    return FRETE_FAIXA_ALTA;
}

module.exports = {
    normalizarCep,
    cepValido,
    calcularFrete,
    FRETE_FAIXA_BAIXA,
    FRETE_FAIXA_MEDIA,
    FRETE_FAIXA_ALTA,
    LIMITE_FRETE_GRATIS
};
