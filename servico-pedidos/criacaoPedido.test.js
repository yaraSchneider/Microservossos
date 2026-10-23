// Testes do fluxo de criação de pedido (tarefa 6.2) — POST /pedidos.
//
// server.js, carrinhoClient.js e produtosClient.js são CommonJS carregados via
// createRequire (fora do grafo de módulos ESM do Vitest). Mockamos o
// `global.fetch` que os clientes usam — a mesma abordagem do Serviço_Carrinho —
// servindo um carrinho e produtos sem precisar dos serviços reais em execução.
//
// Cobre: 201 com snapshot imutável e status PENDENTE; 409 quando o estoque de
// um item é insuficiente (sem reservar nada); 404 quando o carrinho não existe;
// 503 em falha de rede. (Requisitos 6.1, 6.2, 6.3, 6.4, 6.6, 6.7)
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('./server');
const store = app.store;
const prontidao = app.prontidao;

const realFetch = global.fetch;
const CARRINHO_URL = 'http://carrinho:3002';
const PRODUTOS_URL = 'http://produtos:3001';

// Fixtures padrão: um carrinho com um item e um catálogo com estoque amplo.
function cenarioPadrao() {
    return {
        carrinho: {
            id: 'c-111',
            itens: [{ produtoId: 'p-ab12cd', quantidade: 2, precoUnitario: 350000 }],
            cep: '01001000',
            frete: 1500,
            subtotal: 700000,
            total: 701500
        },
        produtos: {
            'p-ab12cd': {
                produto: {
                    id: 'p-ab12cd',
                    nome: 'Notebook',
                    preco: 350000,
                    estoque: 12,
                    atributos: { cor: 'prata' }
                },
                estoque: 12
            }
        }
    };
}

/**
 * Instala um mock de global.fetch que serve o carrinho e os produtos de um
 * cenário. Registra as reservas realizadas em `reservas` para asserts.
 *
 * @param {object} cenario
 * @param {{ carrinhoAusente?: boolean, falharRede?: boolean }} [opts]
 * @returns {{ reservas: Array }}
 */
function mockFetch(cenario, opts = {}) {
    const reservas = [];
    global.fetch = vi.fn(async (url, init) => {
        if (opts.falharRede) {
            throw new Error('ECONNREFUSED');
        }
        const u = String(url);
        const metodo = (init && init.method) || 'GET';

        // GET /carrinho/:id
        const carrinhoMatch = u.match(/\/carrinho\/([^/]+)$/);
        if (carrinhoMatch && u.startsWith(CARRINHO_URL)) {
            if (opts.carrinhoAusente) {
                return new Response(JSON.stringify({ erro: 'Carrinho não encontrado' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
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
            reservas.push({ produtoId: id, quantidade: corpo.quantidade });
            return new Response(JSON.stringify({ id, estoque: cenario.produtos[id].estoque - corpo.quantidade }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // GET /produtos/:id/estoque
        const estoqueMatch = u.match(/\/produtos\/([^/]+)\/estoque$/);
        if (estoqueMatch) {
            const id = estoqueMatch[1];
            const entry = cenario.produtos[id];
            if (!entry) {
                return new Response(JSON.stringify({ erro: 'Produto não encontrado' }), { status: 404 });
            }
            return new Response(JSON.stringify({ id, estoque: entry.estoque }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // GET /produtos/:id
        const produtoMatch = u.match(/\/produtos\/([^/]+)$/);
        if (produtoMatch) {
            const id = produtoMatch[1];
            const entry = cenario.produtos[id];
            if (!entry) {
                return new Response(JSON.stringify({ erro: 'Produto não encontrado' }), { status: 404 });
            }
            return new Response(JSON.stringify(entry.produto), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        throw new Error(`URL não mockada: ${metodo} ${u}`);
    });
    return { reservas };
}

describe('POST /pedidos — fluxo de criação (tarefa 6.2)', () => {
    beforeAll(async () => {
        await prontidao;
        process.env.CARRINHO_URL = CARRINHO_URL;
        process.env.PRODUTOS_URL = PRODUTOS_URL;
    });

    beforeEach(async () => {
        await store.save([]);
    });

    afterEach(() => {
        global.fetch = realFetch;
    });

    afterAll(async () => {
        await store.save([]);
        global.fetch = realFetch;
    });

    it('cria o pedido (201) com snapshot imutável, status PENDENTE e reserva o estoque', async () => {
        const cenario = cenarioPadrao();
        const { reservas } = mockFetch(cenario);

        const res = await request(app)
            .post('/pedidos')
            .send({
                carrinhoId: 'c-111',
                comprador: {
                    nome: 'Maria',
                    cep: '01001000',
                    endereco: 'Rua A',
                    numero: '100',
                    complemento: 'Apto 5'
                }
            });

        expect(res.status).toBe(201);
        expect(res.body.id).toMatch(/^o-[0-9a-f]{6}$/);
        expect(res.body.status).toBe('PENDENTE');
        expect(res.body.carrinhoId).toBe('c-111');
        expect(res.body.subtotal).toBe(700000);
        expect(res.body.frete).toBe(1500);
        expect(res.body.total).toBe(701500);
        expect(res.body.comprador).toEqual({
            nome: 'Maria',
            cep: '01001000',
            endereco: 'Rua A',
            numero: '100',
            complemento: 'Apto 5'
        });
        // Snapshot com nome/preço/atributos do catálogo.
        expect(res.body.itens).toEqual([
            {
                produtoId: 'p-ab12cd',
                nome: 'Notebook',
                precoUnitario: 350000,
                quantidade: 2,
                atributos: { cor: 'prata' }
            }
        ]);
        // Reservou exatamente a quantidade do item.
        expect(reservas).toEqual([{ produtoId: 'p-ab12cd', quantidade: 2 }]);
        // Persistiu o pedido.
        expect(store.getAll()).toHaveLength(1);
    });

    it('complemento é opcional: ausente é gravado como string vazia', async () => {
        const cenario = cenarioPadrao();
        mockFetch(cenario);

        const res = await request(app)
            .post('/pedidos')
            .send({
                carrinhoId: 'c-111',
                comprador: { nome: 'João', cep: '01001000', endereco: 'Rua B', numero: '50' }
            });

        expect(res.status).toBe(201);
        expect(res.body.comprador.complemento).toBe('');
    });

    it('recusa com 409 "Estoque insuficiente" sem reservar nada', async () => {
        const cenario = cenarioPadrao();
        cenario.produtos['p-ab12cd'].estoque = 1; // item pede 2
        const { reservas } = mockFetch(cenario);

        const res = await request(app)
            .post('/pedidos')
            .send({
                carrinhoId: 'c-111',
                comprador: { nome: 'Maria', cep: '01001000', endereco: 'Rua A', numero: '100' }
            });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ erro: 'Estoque insuficiente' });
        // Nenhuma reserva deve ter sido feita.
        expect(reservas).toEqual([]);
        // Nenhum pedido persistido.
        expect(store.getAll()).toHaveLength(0);
    });

    it('retorna 404 quando o carrinho não existe', async () => {
        const cenario = cenarioPadrao();
        mockFetch(cenario, { carrinhoAusente: true });

        const res = await request(app)
            .post('/pedidos')
            .send({
                carrinhoId: 'c-inexistente',
                comprador: { nome: 'Maria', cep: '01001000', endereco: 'Rua A', numero: '100' }
            });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ erro: 'Carrinho não encontrado' });
    });

    it('retorna 503 amigável quando a rede falha', async () => {
        mockFetch(cenarioPadrao(), { falharRede: true });

        const res = await request(app)
            .post('/pedidos')
            .send({
                carrinhoId: 'c-111',
                comprador: { nome: 'Maria', cep: '01001000', endereco: 'Rua A', numero: '100' }
            });

        expect(res.status).toBe(503);
        expect(res.body.erro).toMatch(/indispon/i);
    });

    it('valida os dados do comprador (400 quando falta campo obrigatório)', async () => {
        const res = await request(app)
            .post('/pedidos')
            .send({ carrinhoId: 'c-111', comprador: { nome: 'Maria', cep: '01001000' } });

        expect(res.status).toBe(400);
        expect(res.body.erro).toMatch(/comprador/i);
    });
});
