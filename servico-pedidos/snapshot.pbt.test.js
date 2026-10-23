// Teste baseado em propriedades (PBT) — snapshot imutável do pedido (tarefa 6.4).
//
// Feature: ecommerce-microservices, Property 8: Snapshot do pedido imutável
//
// **Validates: Requisitos 6.4, 6.7, 7.7**
//
// Propriedade: para qualquer pedido criado, alterações POSTERIORES de preço ou
// atributos dos produtos no catálogo NÃO modificam o snapshot de itens e valores
// registrado no pedido.
//
// Abordagem (mesma dos demais testes do Serviço_Pedidos): server.js e os
// clientes HTTP (carrinhoClient/produtosClient) são CommonJS carregados via
// createRequire e conversam com os backends por `global.fetch`, que mockamos.
// O mock aqui mantém o estado do catálogo em um objeto mutável: criamos o
// pedido, capturamos o snapshot, mutamos o produto no catálogo (preço/nome/
// atributos para valores arbitrários diferentes) e então verificamos, via
// GET /pedidos/:id, que o snapshot permanece inalterado.
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
 * Instala um mock de global.fetch cujo catálogo é MUTÁVEL. O produto servido em
 * GET /produtos/:id e GET /produtos/:id/estoque é lido do objeto `catalogo` a
 * cada chamada, permitindo simular alterações posteriores no catálogo.
 *
 * @param {{ carrinho: object, catalogo: Record<string, object> }} cenario
 */
function mockFetch(cenario) {
    global.fetch = vi.fn(async (url, init) => {
        const u = String(url);
        const metodo = (init && init.method) || 'GET';

        // GET /carrinho/:id
        const carrinhoMatch = u.match(/\/carrinho\/([^/]+)$/);
        if (carrinhoMatch && u.startsWith(CARRINHO_URL)) {
            return new Response(JSON.stringify(cenario.carrinho), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // POST /produtos/:id/reservar
        const reservarMatch = u.match(/\/produtos\/([^/]+)\/reservar$/);
        if (reservarMatch && metodo === 'POST') {
            const id = reservarMatch[1];
            const corpo = init && init.body ? JSON.parse(init.body) : {};
            const atual = cenario.catalogo[id];
            return new Response(
                JSON.stringify({ id, estoque: atual.estoque - corpo.quantidade }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // GET /produtos/:id/estoque — lê o estado MUTÁVEL do catálogo.
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

        // GET /produtos/:id — lê o estado MUTÁVEL do catálogo.
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
}

describe('PBT — Propriedade 8: Snapshot do pedido imutável (tarefa 6.4)', () => {
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

    // Gerador de um mapa de atributos arbitrário (pares chave-valor string).
    const atributosArb = fc.dictionary(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ maxLength: 12 }),
        { maxKeys: 4 }
    );

    it('alterações posteriores de preço/nome/atributos no catálogo não mudam o snapshot', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Estado original do produto no momento da compra.
                fc.record({
                    nome: fc.string({ minLength: 1, maxLength: 20 }),
                    preco: fc.integer({ min: 0, max: 10_000_000 }),
                    atributos: atributosArb,
                    quantidade: fc.integer({ min: 1, max: 20 })
                }),
                // Novos valores (potencialmente diferentes) aplicados ao catálogo
                // DEPOIS da criação do pedido.
                fc.record({
                    nome: fc.string({ minLength: 1, maxLength: 20 }),
                    preco: fc.integer({ min: 0, max: 10_000_000 }),
                    atributos: atributosArb
                }),
                // carrinhoId único por execução evita colisão de idempotência.
                fc.uuid(),
                async (original, alteracao, sufixo) => {
                    await store.save([]);

                    const produtoId = 'p-snap';
                    const carrinhoId = `c-${sufixo}`;

                    // Estoque amplo para nunca recusar por estoque.
                    const estoqueAmplo = original.quantidade + 1000;

                    const cenario = {
                        carrinho: {
                            id: carrinhoId,
                            itens: [
                                {
                                    produtoId,
                                    quantidade: original.quantidade,
                                    precoUnitario: original.preco
                                }
                            ],
                            cep: '01001000',
                            frete: 1500,
                            subtotal: original.preco * original.quantidade,
                            total: original.preco * original.quantidade + 1500
                        },
                        catalogo: {
                            [produtoId]: {
                                id: produtoId,
                                nome: original.nome,
                                preco: original.preco,
                                estoque: estoqueAmplo,
                                atributos: { ...original.atributos }
                            }
                        }
                    };

                    mockFetch(cenario);

                    // Cria o pedido e captura o snapshot no momento da compra.
                    const criado = await request(app)
                        .post('/pedidos')
                        .send({ carrinhoId, comprador: COMPRADOR });

                    expect(criado.status).toBe(201);
                    const snapshotNaCriacao = criado.body.itens;
                    expect(snapshotNaCriacao).toEqual([
                        {
                            produtoId,
                            nome: original.nome,
                            precoUnitario: original.preco,
                            quantidade: original.quantidade,
                            atributos: { ...original.atributos }
                        }
                    ]);

                    // Altera o catálogo DEPOIS da criação do pedido.
                    cenario.catalogo[produtoId].nome = alteracao.nome;
                    cenario.catalogo[produtoId].preco = alteracao.preco;
                    cenario.catalogo[produtoId].atributos = { ...alteracao.atributos };

                    // Relê o pedido persistido: o snapshot deve permanecer igual
                    // ao capturado na criação, independentemente da alteração.
                    const relido = await request(app).get(`/pedidos/${criado.body.id}`);
                    expect(relido.status).toBe(200);
                    expect(relido.body.itens).toEqual(snapshotNaCriacao);
                    expect(relido.body.subtotal).toBe(criado.body.subtotal);
                    expect(relido.body.frete).toBe(criado.body.frete);
                    expect(relido.body.total).toBe(criado.body.total);
                }
            ),
            { numRuns: 100 }
        );
    }, 30000);
});
