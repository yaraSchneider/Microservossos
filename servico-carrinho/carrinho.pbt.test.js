// Teste baseado em propriedades (PBT) do cálculo de subtotal/total (carrinho.js).
//
// Implementa a Propriedade 2 da seção Correctness Properties do design,
// usando fast-check com no mínimo 100 iterações (numRuns: 100). Testa as
// funções puras calcularSubtotal/calcularValores diretamente (sem HTTP),
// mantendo o teste rápido e determinístico.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fc from 'fast-check';

// carrinho.js é CommonJS; carrega via createRequire para interoperar com ESM.
const require = createRequire(import.meta.url);
const { calcularSubtotal, calcularValores } = require('./carrinho');

// Feature: ecommerce-microservices, Property 2: Subtotal e total consistentes
describe('Propriedade 2: Subtotal e total consistentes', () => {
  // Gerador de Item_Carrinho válido:
  // - produtoId: string não vazia;
  // - precoUnitario: inteiro não negativo (centavos);
  // - quantidade: inteiro positivo.
  const itemArb = fc.record({
    produtoId: fc.string({ minLength: 1, maxLength: 12 }).map((s) => 'p-' + s),
    precoUnitario: fc.nat({ max: 1_000_000 }),
    quantidade: fc.integer({ min: 1, max: 1000 })
  });

  const itensArb = fc.array(itemArb, { maxLength: 20 });

  // Frete: inteiro não negativo (centavos) OU ausente (undefined) para cobrir
  // a regra "frete = 0 quando não calculado".
  const freteArb = fc.option(fc.nat({ max: 100_000 }), { nil: undefined });

  it('subtotal = soma(precoUnitario*quantidade) e total = subtotal + (frete||0)', () => {
    fc.assert(
      fc.property(itensArb, freteArb, (itens, frete) => {
        // Subtotal esperado calculado manualmente a partir dos itens.
        const subtotalEsperado = itens.reduce(
          (soma, item) => soma + item.precoUnitario * item.quantidade,
          0
        );

        // calcularSubtotal corresponde ao reduce manual.
        expect(calcularSubtotal(itens)).toBe(subtotalEsperado);

        const carrinho = frete === undefined ? { itens } : { itens, frete };
        const r = calcularValores(carrinho);

        // subtotal consistente com os itens.
        expect(r.subtotal).toBe(subtotalEsperado);

        // total = subtotal + frete, com frete=0 quando ausente.
        const freteEsperado = frete === undefined ? 0 : frete;
        expect(r.total).toBe(subtotalEsperado + freteEsperado);

        // Caso frete ausente: total === subtotal.
        if (frete === undefined) {
          expect(r.total).toBe(r.subtotal);
        }
      }),
      { numRuns: 100 }
    );
  }, 30000);
});
