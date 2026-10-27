// ---------------------------------------------------------------------------
// Testes do modelo de peça do brechó (leitura de atributos e economia).
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { descreverAtributo, lerPeca, percentualEconomia } from './peca.js';
import { formatarReais } from './formato.js';

describe('lerPeca', () => {
    it('separa os dados de vestuário dos detalhes extras', () => {
        const peca = lerPeca({
            atributos: {
                tamanho: 'M',
                marca: "Levi's",
                estado: 'vintage',
                precoOriginal: '39990',
                decada: 'anos 90',
            },
        });
        expect(peca.tamanho).toBe('M');
        expect(peca.marca).toBe("Levi's");
        expect(peca.estado).toBe('vintage');
        expect(peca.precoOriginal).toBe(39990);
        expect(peca.extras).toEqual([['decada', 'anos 90']]);
    });

    it('tolera produto sem atributos', () => {
        const peca = lerPeca({});
        expect(peca.tamanho).toBe('');
        expect(peca.precoOriginal).toBeNull();
        expect(peca.extras).toEqual([]);
        expect(lerPeca(undefined).extras).toEqual([]);
    });

    it('ignora preço original inválido', () => {
        expect(lerPeca({ atributos: { precoOriginal: 'abc' } }).precoOriginal).toBeNull();
        expect(lerPeca({ atributos: { precoOriginal: '0' } }).precoOriginal).toBeNull();
    });
});

describe('percentualEconomia', () => {
    it('calcula a economia arredondada', () => {
        expect(percentualEconomia(3000, 10000)).toBe(70);
    });

    it('retorna null sem preço original maior', () => {
        expect(percentualEconomia(3000, null)).toBeNull();
        expect(percentualEconomia(3000, 3000)).toBeNull();
        expect(percentualEconomia(3000, 2000)).toBeNull();
    });
});

describe('descreverAtributo', () => {
    it('traduz chaves conhecidas para rótulos legíveis', () => {
        expect(descreverAtributo('estado', 'seminova', formatarReais)).toEqual(['Estado', 'Seminova']);
        expect(descreverAtributo('cor', 'terracota', formatarReais)).toEqual(['Cor', 'Terracota']);
        const [rotulo, valor] = descreverAtributo('precoOriginal', '12000', formatarReais);
        expect(rotulo).toBe('Preço original');
        expect(valor.replace(/ /g, ' ')).toBe('R$ 120,00');
    });

    it('mantém chaves livres como estão', () => {
        expect(descreverAtributo('forro', 'sim', formatarReais)).toEqual(['forro', 'sim']);
    });
});
