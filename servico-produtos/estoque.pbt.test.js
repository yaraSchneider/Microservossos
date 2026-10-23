// Testes baseados em propriedades (PBT) do controle de estoque do
// Serviço_Produtos (endpoints reservar/devolver em server.js).
//
// Implementa as Propriedades 3 e 4 da seção Correctness Properties do design,
// usando fast-check com no mínimo 100 iterações (numRuns: 100) e exercitando
// os endpoints HTTP reais via supertest sobre o app Express exportado.
//
// - Propriedade 3 (tarefa 2.6): reserva nunca deixa o estoque negativo e é
//   limitada ao disponível. Validates: Requisitos 2.2, 2.3.
// - Propriedade 4 (tarefa 2.7): round-trip reservar/devolver preserva o estoque
//   original. Validates: Requisitos 2.2, 2.4.
//
// Cada execução semeia um produto com estoque arbitrário via store.save(...),
// isolando o estado entre runs, e deixa data/produtos.json como [] ao final.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import fc from 'fast-check';

// server.js é CommonJS; carrega via createRequire para interoperar com ESM.
const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('./server');
const store = app.store;
const prontidao = app.prontidao;

// Semeia o store com um único produto de estoque conhecido e retorna o id.
async function semearProduto(estoque) {
  const id = 'p-estoque-pbt';
  await store.save([
    {
      id,
      nome: 'Produto PBT',
      descricao: 'Produto para teste de estoque',
      categoria: 'Teste',
      preco: 1000,
      estoque,
      imagemUrl: '',
      atributos: {},
    },
  ]);
  return id;
}

beforeAll(async () => {
  // Garante que o store inicializou (arquivo criado/carregado) antes das reqs.
  await prontidao;
});

afterAll(async () => {
  // Deixa data/produtos.json como [] ao final da suíte.
  await store.save([]);
});

// Feature: ecommerce-microservices, Property 3: Estoque nunca negativo e reserva limitada ao disponível
describe('Propriedade 3: Estoque nunca negativo e reserva limitada ao disponível', () => {
  it('reserva acima do disponível é recusada (409) sem alterar; caso contrário reduz exatamente e nunca fica negativo', async () => {
    await fc.assert(
      fc.asyncProperty(
        // E: estoque inicial arbitrário não negativo.
        fc.nat({ max: 10_000 }),
        // Q: quantidade de reserva arbitrária >= 1.
        fc.integer({ min: 1, max: 10_000 }),
        async (E, Q) => {
          const id = await semearProduto(E);

          const res = await request(app)
            .post(`/produtos/${id}/reservar`)
            .send({ quantidade: Q });

          if (Q <= E) {
            // Disponível: reserva aceita e reduz exatamente pela quantidade.
            expect(res.status).toBe(200);
            expect(res.body.estoque).toBe(E - Q);
            expect(res.body.estoque).toBeGreaterThanOrEqual(0);
          } else {
            // Insuficiente: recusa com 409 e estoque permanece inalterado.
            expect(res.status).toBe(409);
            expect(res.body).toHaveProperty('erro');
          }

          // Em qualquer caso, o estoque persistido nunca é negativo e, quando
          // a reserva foi recusada, permanece igual ao original.
          const consulta = await request(app).get(`/produtos/${id}/estoque`);
          expect(consulta.status).toBe(200);
          expect(consulta.body.estoque).toBeGreaterThanOrEqual(0);
          const esperado = Q <= E ? E - Q : E;
          expect(consulta.body.estoque).toBe(esperado);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

// Feature: ecommerce-microservices, Property 4: Round-trip de reserva e devolução preserva o estoque
describe('Propriedade 4: Round-trip de reserva e devolução preserva o estoque', () => {
  it('reservar uma quantidade reservável e depois devolvê-la resulta no estoque original', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Gera E (estoque) e Q reservável (1 <= Q <= E) de forma dependente.
        fc
          .integer({ min: 1, max: 10_000 })
          .chain((E) =>
            fc.record({
              E: fc.constant(E),
              Q: fc.integer({ min: 1, max: E }),
            })
          ),
        async ({ E, Q }) => {
          const id = await semearProduto(E);

          // Reserva uma quantidade reservável: reduz para E - Q.
          const reserva = await request(app)
            .post(`/produtos/${id}/reservar`)
            .send({ quantidade: Q });
          expect(reserva.status).toBe(200);
          expect(reserva.body.estoque).toBe(E - Q);

          // Devolve a mesma quantidade: volta ao estoque original.
          const devolucao = await request(app)
            .post(`/produtos/${id}/devolver`)
            .send({ quantidade: Q });
          expect(devolucao.status).toBe(200);
          expect(devolucao.body.estoque).toBe(E);

          // Estado persistido confirma o estoque original.
          const consulta = await request(app).get(`/produtos/${id}/estoque`);
          expect(consulta.status).toBe(200);
          expect(consulta.body.estoque).toBe(E);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
