// ---------------------------------------------------------------------------
// Testes do utilitário de formatação monetária (formatarReais).
// (Requisito 11.9 — valores monetários formatados em reais)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { formatarReais } from './formato.js';

// A saída do Intl.NumberFormat pt-BR usa um espaço não separável (U+00A0)
// entre "R$" e o número. Normalizamos para espaço comum antes de comparar
// para evitar fragilidade com o caractere de whitespace.
function normalizar(texto) {
    return texto.replace(/\u00a0/g, ' ');
}

describe('formatarReais', () => {
    it('formata centavos como reais com separador de milhar', () => {
        expect(normalizar(formatarReais(350000))).toBe('R$ 3.500,00');
    });

    it('formata zero centavos', () => {
        expect(normalizar(formatarReais(0))).toBe('R$ 0,00');
    });

    it('formata um centavo', () => {
        expect(normalizar(formatarReais(1))).toBe('R$ 0,01');
    });

    it('formata um valor arbitrário com duas casas decimais', () => {
        expect(normalizar(formatarReais(12345))).toBe('R$ 123,45');
    });

    it('trata valores não numéricos como zero', () => {
        expect(normalizar(formatarReais(undefined))).toBe('R$ 0,00');
        expect(normalizar(formatarReais(NaN))).toBe('R$ 0,00');
    });
});
