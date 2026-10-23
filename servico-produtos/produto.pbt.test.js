// Teste baseado em propriedades (PBT) do modelo de Produto (produto.js).
//
// Implementa a Propriedade 1 da seção Correctness Properties do design,
// usando fast-check com no mínimo 100 iterações (numRuns: 100).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fc from 'fast-check';

// produto.js é CommonJS; carrega via createRequire para interoperar com ESM.
const require = createRequire(import.meta.url);
const { validarProduto, criarProduto } = require('./produto');

// Feature: ecommerce-microservices, Property 1: Preço sempre em centavos (inteiro não negativo)
describe('Propriedade 1: Preço sempre em centavos (inteiro não negativo)', () => {
  // Gerador de entradas válidas de Produto.
  // - nome: string não vazia (após trim);
  // - preco: inteiro não negativo (centavos);
  // - estoque: inteiro não negativo;
  // - campos opcionais e atributos dinâmicos.
  const entradaValidaArb = fc.record({
    nome: fc
      .string({ minLength: 1, maxLength: 40 })
      // Garante conteúdo após trim (nome não vazio).
      .map((s) => s + 'x'),
    descricao: fc.string({ maxLength: 80 }),
    categoria: fc.string({ maxLength: 40 }),
    preco: fc.nat(),
    estoque: fc.nat(),
    imagemUrl: fc.webUrl(),
    atributos: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 16 }),
      fc.oneof(fc.string({ maxLength: 20 }), fc.integer(), fc.boolean())
    )
  });

  it('validarProduto/criarProduto preservam preco inteiro >= 0', () => {
    fc.assert(
      fc.property(entradaValidaArb, (entrada) => {
        const validado = validarProduto(entrada);
        expect(validado.valido).toBe(true);
        expect(Number.isInteger(validado.produto.preco)).toBe(true);
        expect(validado.produto.preco).toBeGreaterThanOrEqual(0);

        const criado = criarProduto(entrada);
        expect(criado.valido).toBe(true);
        expect(Number.isInteger(criado.produto.preco)).toBe(true);
        expect(criado.produto.preco).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  }, 30000);

  // Cobre o lado de validação do Requisito 1.9: preços que não são inteiros
  // não negativos são sempre rejeitados (nenhum valor inválido é armazenado).
  it('rejeita preços que não são inteiros não negativos', () => {
    const precoInvalidoArb = fc.oneof(
      fc.integer({ min: -1_000_000, max: -1 }),
      fc.double({ min: -1_000_000, max: 1_000_000, noInteger: true, noNaN: true }),
      fc.string(),
      fc.constantFrom(NaN, Infinity, -Infinity, null, undefined)
    );

    fc.assert(
      fc.property(
        fc.record({
          nome: fc.string({ minLength: 1 }).map((s) => s + 'x'),
          estoque: fc.nat(),
          preco: precoInvalidoArb
        }),
        (entrada) => {
          const r = validarProduto(entrada);
          expect(r.valido).toBe(false);
          expect(r.erro).toBe('Preço inválido');
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
