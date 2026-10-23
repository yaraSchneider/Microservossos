// Teste baseado em propriedades (PBT) — idempotência da finalização (tarefa 6.5).
//
// Feature: ecommerce-microservices, Property 9: Idempotência da finalização de compra
//
// **Validates: Requisitos 6.5**
//
// Propriedade: para qualquer sequência de N (>= 2) tentativas de finalização com
// a MESMA chave de idempotência (mesmo carrinho), apenas UM pedido é criado,
// todas as tentativas retornam o MESMO pedido e o estoque é reservado uma única
// vez no total.
//
// Abordagem (mesma dos demais testes do Serviço_Pedidos): server.js e os
// clientes HTTP são CommonJS carregados via createRequire e conversam com os
// backends por `global.fetch`, que mockamos. O mock conta cada chamada de
// reserva para verificarmos que a reserva ocorre exatamente uma vez.
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';
import fc from 'fast-check';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('./server');
const store = app.store;
const prontidao = app.prontidao;

const realFetch = global.fetch;
const CARRINHO_URL = 'http://carrinho:3002';
const PRODUTOS_URL = 'http://produtos:3001';

const COMPRADOR = {
    nome: 'Maria',
    cep: '01001000',
    endereco: 'Rua A',
    numero: '100',
    complemento: 'Apto 5'
};

/**
 * Instala um mock de global.fetch que serve o carrinho e os produtos de um
 * cenário com estoque amplo. Registra cada reserva efetuada em `reservas` para
 * verificar que o estoque é reservado uma única vez.
 *
 * @param {{ carrinho: object, catalogo: Record<string, object> }} cenario
 * @returns {{ reservas: Array<{ produtoId: string, quantidade: number }> }}
 */
function mockFetch(cenario) {
    const reservas = [];
    global.fetch = vi.fn(async (url, init) => {
        const u = String(url);
        const metodo = (init && init.method) || 'GET';

        const carrinhoMatch = u.match(/\/carrinho\/([^/]+)$/);
        if (carrinhoMatch && u.startsWith(CARRINHO_URL)) {
            return new Response(JSON.stringify(cenario.carrinho), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const reservarMatch = u.match(/\/produtos\/([^/]+)\/reservar$/);
        if (reservarMatch && metodo === 'POST') {
            const id = reservarMatch[1];
            const corpo = init && init.body ? JSON.parse(init.body) : {};
            reservas.push({ produtoId: id, quantidade: corpo.quantidade });
            const atual = cenario.catalogo[id];
            return new Response(
                JSON.stringify({ id, estoque: atual.estoque - corpo.quantidade }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const estoqueMatch = u.match(/\/produtos\/([^/]+)\/estoque$/);
        if (estoqueMatch) {
            const id = estoqueMatch[1];
            const atual = cenario.catalogo[id];
            if (!atual) {
                return new Response(JSON.stringify({ erro: 'Produto não encontrado' }), { status: 404 });
            }
            return new Response(JSON.stringify({ id, estoque: atual.estoque }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const produtoMatch = u.match(/\/produtos\/([^/]+)$/);
        if (produtoMatch) {
            const id = produtoMatch[1];
            const atual = cenario.catalogo[id];
            if (!atual) {
                return new Response(JSON.stringify({ erro: 'Produto não encontrado' }), { status: 404 });
            }
            return new Response(JSON.stringify(atual), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        throw new Error(`URL não mockada: ${metodo} ${u}`);
    });
    return { reservas };
}

describe('PBT — Propriedade 9: Idempotência da finalização de compra (tarefa 6.5)', () => {
    beforeAll(async () => {
        await prontidao;
        process.env.CARRINHO_URL = CARRINHO_URL;
        process.env.PRODUTOS_URL = PRODUTOS_URL;
    });

    afterEach(() => {
        global.fetch = realFetch;
    });

    afterAll(async () => {
        await store.save([]);
        global.fetch = realFetch;
    });

    it('N tentativas com a mesma chave criam um único pedido e reservam o estoque uma única vez', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Número de tentativas (>= 2) com a mesma chave de idempotência.
                fc.integer({ min: 2, max: 6 }),
                // Quantidade do item.
                fc.integer({ min: 1, max: 20 }),
                // carrinhoId único por execução evita colisão entre execuções.
                fc.uuid(),
                async (nTentativas, quantidade, sufixo) => {
                    await store.save([]);

                    const produtoId = 'p-idem';
                    const carrinhoId = `c-${sufixo}`;
                    const preco = 350000;

                    const cenario = {
                        carrinho: {
                            id: carrinhoId,
                            itens: [{ produtoId, quantidade, precoUnitario: preco }],
                            cep: '01001000',
                            frete: 1500,
                            subtotal: preco * quantidade,
                            total: preco * quantidade + 1500
                        },
                        catalogo: {
                            [produtoId]: {
                                id: produtoId,
                                nome: 'Notebook',
                                preco,
                                estoque: quantidade + 1000,
                                atributos: { cor: 'prata' }
                            }
                        }
                    };

                    const { reservas } = mockFetch(cenario);

                    const respostas = [];
                    for (let i = 0; i < nTentativas; i += 1) {
                        // eslint-disable-next-line no-await-in-loop
                        const res = await request(app)
                            .post('/pedidos')
                            .send({ carrinhoId, comprador: COMPRADOR });
                        respostas.push(res);
                    }

                    // A primeira tentativa cria (201); as demais são duplicatas
                    // idempotentes (200).
                    expect(respostas[0].status).toBe(201);
                    for (let i = 1; i < respostas.length; i += 1) {
                        expect(respostas[i].status).toBe(200);
                    }

                    // Todas as tentativas retornam o MESMO pedido.
                    const idEsperado = respostas[0].body.id;
                    for (const res of respostas) {
                        expect(res.body.id).toBe(idEsperado);
                    }

                    // Apenas UM pedido foi persistido.
                    expect(store.getAll()).toHaveLength(1);

                    // A reserva de estoque ocorreu exatamente uma vez no total.
                    expect(reservas).toEqual([{ produtoId, quantidade }]);
                }
            ),
            { numRuns: 100 }
        );
    }, 30000);
});
