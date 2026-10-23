// Teste baseado em propriedades (PBT) do preço unitário obtido do catálogo.
//
// Implementa a Propriedade 7 da seção Correctness Properties do design,
// usando fast-check com no mínimo 100 iterações (numRuns: 100).
//
// Como server.js e produtosClient.js são CommonJS carregados via createRequire
// (fora do grafo de módulos ESM do Vitest), mockamos o `global.fetch` que o
// produtosClient usa — a mesma abordagem de itens.test.js — servindo um
// produto com o preço de catálogo gerado e estoque amplo. A requisição é
// conduzida via supertest contra o app exportado.
//
// Propriedade: para um preço de catálogo arbitrário (inteiro não negativo, com
// estoque amplo) e um valor `preco` arbitrário (possivelmente adversarial:
// número, string ou ausente) no corpo da requisição, após
// POST /carrinho/:id/itens o precoUnitario gravado é sempre igual ao preço do
// catálogo, independentemente do corpo.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';
import fc from 'fast-check';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('./server');
const store = app.store;
const prontidao = app.prontidao;

const realFetch = global.fetch;

/**
 * Configura um fetch falso que responde às rotas do Serviço_Produtos para um
 * único produto 'p-1' com o preço de catálogo e o estoque informados.
 */
function mockProduto(precoCatalogo, estoque) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    const estoqueMatch = u.match(/\/produtos\/([^/]+)\/estoque$/);
    if (estoqueMatch) {
      return { ok: true, status: 200, json: async () => ({ id: 'p-1', estoque }) };
    }
    const produtoMatch = u.match(/\/produtos\/([^/]+)$/);
    if (produtoMatch) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'p-1', preco: precoCatalogo, estoque })
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

// Feature: ecommerce-microservices, Property 7: Preço unitário sempre obtido do catálogo
describe('Propriedade 7: Preço unitário sempre obtido do catálogo', () => {
  beforeAll(async () => {
    await prontidao;
  });

  afterAll(async () => {
    await store.save([]);
    global.fetch = realFetch;
  });

  // Preço de catálogo: inteiro não negativo (centavos).
  const precoCatalogoArb = fc.nat({ max: 10_000_000 });

  // Valor adversarial de `preco` no corpo: número qualquer, string, ou ausente.
  // Deve ser sempre ignorado pelo Serviço_Carrinho (Requisito 3.4).
  const precoCorpoArb = fc.oneof(
    fc.integer({ min: -1_000_000, max: 1_000_000 }),
    fc.double({ noNaN: true }),
    fc.string(),
    fc.constant(undefined)
  );

  it('precoUnitario gravado === preço do catálogo, ignorando o preço do corpo', async () => {
    await fc.assert(
      fc.asyncProperty(precoCatalogoArb, precoCorpoArb, async (precoCatalogo, precoCorpo) => {
        // Estado limpo por execução: estoque amplo garante que a adição nunca
        // seja recusada por estoque insuficiente.
        await store.save([]);
        mockProduto(precoCatalogo, 1_000_000);

        // Cria um carrinho novo a cada execução.
        const criado = await request(app).post('/carrinho').send();
        const id = criado.body.id;

        // Monta o corpo: inclui `preco` apenas quando não for `undefined`.
        const corpo = { produtoId: 'p-1', quantidade: 1 };
        if (precoCorpo !== undefined) {
          corpo.preco = precoCorpo;
        }

        const res = await request(app).post(`/carrinho/${id}/itens`).send(corpo);

        expect(res.status).toBe(201);
        expect(res.body.itens).toHaveLength(1);
        // precoUnitario SEMPRE do catálogo, independentemente do corpo.
        expect(res.body.itens[0].precoUnitario).toBe(precoCatalogo);
        expect(res.body.subtotal).toBe(precoCatalogo);
      }),
      { numRuns: 100 }
    );
  }, 30000);
});
