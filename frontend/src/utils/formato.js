// ---------------------------------------------------------------------------
// Utilitário de formatação monetária
//
// Os valores monetários trafegam SEMPRE em centavos (inteiro) entre os
// serviços, sendo formatados em reais apenas na camada de apresentação.
// (Requisitos 5.4, 11.9)
//
// Ex.: formatarReais(350000) -> "R$ 3.500,00"
//      formatarReais(0)      -> "R$ 0,00"
//      formatarReais(1)      -> "R$ 0,01"
// ---------------------------------------------------------------------------

const formatador = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});

/**
 * Formata um valor em centavos como moeda brasileira (Real).
 *
 * @param {number} centavos Valor inteiro em centavos.
 * @returns {string} Valor formatado, ex.: "R$ 3.500,00".
 */
export function formatarReais(centavos) {
    const valor = Number(centavos);
    if (!Number.isFinite(valor)) {
        return formatador.format(0);
    }
    return formatador.format(valor / 100);
}

export default formatarReais;
