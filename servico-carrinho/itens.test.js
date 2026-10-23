// Testes de gestão de itens do carrinho (tarefa 4.4) — integração REST ao
// Serviço_Produtos. Como server.js e produtosClient.js são CommonJS carregados
// via createRequire (fora do grafo de módulos ESM do Vitest), mockamos o
// `global.fetch` que o produtosClient usa, exercitando o cliente real de ponta
// a ponta sem um Serviço_Produtos em execução.
//
// Cobre:
//  - POST /carrinho/:id/itens: 201 gravando precoUnitario do catálogo
//    (ignorando preço do corpo), 400 validação, 404 carrinho/produto, 409
//    estoque insuficiente, 503 indisponibilidade.
//  - PUT /carrinho/:id/itens/:produtoId: 200 altera quantidade, 404, 409.
//  - DELETE /carrinho/:id/itens/:produtoId: 200 remove, 404.
//  - DELETE /carrinho/:id/itens: 200 limpa todos, 404.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('./server');
const store = app.store;
const prontidao = app.prontidao;

const realFetch = global.fetch;

/**
 * Configura um fetch falso que responde às rotas do Serviço_Produtos a partir
 * de um "catálogo" em memória: { [produtoId]: { preco, estoque } }.
 * produtoId ausente -> 404. Passar `catalogo = null` simula indisponibilidade
 * (fetch lança erro de rede).
 */
function mockProdutos(catalogo) {
    global.fetch = vi.fn(async (url) => {
        if (catalogo === null) {
            throw new Error('ECONNREFUSED');
        }
        const u = String(url);
        const estoqueMatch = u.match(/\/produtos\/([^/]+)\/estoque$/);
        if (estoqueMatch) {
            const pid = decodeURIComponent(estoqueMatch[1]);
            const p = catalogo[pid];
            if (!p) {
                return { ok: false, status: 404, json: async () => ({ erro: 'Produto não encontrado' }) };
            }
            return { ok: true, status: 200, json: async () => ({ id: pid, estoque: p.estoque }) };
        }
        const produtoMatch = u.match(/\/produtos\/([^/]+)$/);
        if (produtoMatch) {
            const pid = decodeURIComponent(produtoMatch[1]);
            const p = catalogo[pid];
            if (!p) {
                return { ok: false, status: 404, json: async () => ({ erro: 'Produto não encontrado' }) };
            }
            return { ok: true, status: 200, json: async () => ({ id: pid, preco: p.preco, estoque: p.estoque }) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
    });
}

async function criarCarrinho() {
    const res = await request(app).post('/carrinho').send();
    return res.body.id;
}

describe('Serviço_Carrinho — gestão de itens (tarefa 4.4)', () => {
    beforeAll(async () => {
        await prontidao;
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

    it('POST adiciona item gravando precoUnitario do catálogo e ignorando preço do corpo (201)', async () => {
        mockProdutos({ 'p-1': { preco: 350000, estoque: 10 } });

        const id = await criarCarrinho();
        const res = await request(app)
            .post(`/carrinho/${id}/itens`)
            .send({ produtoId: 'p-1', quantidade: 2, preco: 1 }); // preco do corpo deve ser ignorado

        expect(res.status).toBe(201);
        expect(res.body.itens).toEqual([
            { produtoId: 'p-1', quantidade: 2, precoUnitario: 350000 }
        ]);
        expect(res.body.subtotal).toBe(700000);
        expect(res.body.total).toBe(700000);
    });

    it('POST recusa com 409 quando a quantidade excede o estoque', async () => {
        mockProdutos({ 'p-1': { preco: 1000, estoque: 3 } });

        const id = await criarCarrinho();
        const res = await request(app)
            .post(`/carrinho/${id}/itens`)
            .send({ produtoId: 'p-1', quantidade: 5 });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ erro: 'Estoque insuficiente' });
    });

    it('POST retorna 404 quando o produto não existe no catálogo', async () => {
        mockProdutos({});

        const id = await criarCarrinho();
        const res = await request(app)
            .post(`/carrinho/${id}/itens`)
            .send({ produtoId: 'p-x', quantidade: 1 });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ erro: 'Produto não encontrado' });
    });

    it('POST retorna 404 para carrinho inexistente', async () => {
        mockProdutos({ 'p-1': { preco: 1000, estoque: 10 } });
        const res = await request(app)
            .post('/carrinho/c-naoexiste/itens')
            .send({ produtoId: 'p-1', quantidade: 1 });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ erro: 'Carrinho não encontrado' });
    });

    it('POST retorna 400 para quantidade inválida', async () => {
        const id = await criarCarrinho();
        const res = await request(app)
            .post(`/carrinho/${id}/itens`)
            .send({ produtoId: 'p-1', quantidade: 0 });

        expect(res.status).toBe(400);
        expect(res.body.erro).toBeDefined();
    });

    it('POST retorna 503 quando o Serviço_Produtos está indisponível', async () => {
        mockProdutos(null);

        const id = await criarCarrinho();
        const res = await request(app)
            .post(`/carrinho/${id}/itens`)
            .send({ produtoId: 'p-1', quantidade: 1 });

        expect(res.status).toBe(503);
        expect(res.body.erro).toMatch(/indispon/i);
    });

    it('POST soma à quantidade existente e revalida estoque', async () => {
        mockProdutos({ 'p-1': { preco: 1000, estoque: 5 } });

        const id = await criarCarrinho();
        await request(app).post(`/carrinho/${id}/itens`).send({ produtoId: 'p-1', quantidade: 3 });
        const segundo = await request(app)
            .post(`/carrinho/${id}/itens`)
            .send({ produtoId: 'p-1', quantidade: 2 });

        expect(segundo.status).toBe(201);
        expect(segundo.body.itens).toEqual([
            { produtoId: 'p-1', quantidade: 5, precoUnitario: 1000 }
        ]);

        // Uma terceira adição excederia o estoque (5 + 1 > 5).
        const terceiro = await request(app)
            .post(`/carrinho/${id}/itens`)
            .send({ produtoId: 'p-1', quantidade: 1 });
        expect(terceiro.status).toBe(409);
    });

    it('PUT altera a quantidade de um item existente (200)', async () => {
        mockProdutos({ 'p-1': { preco: 2000, estoque: 10 } });

        const id = await criarCarrinho();
        await request(app).post(`/carrinho/${id}/itens`).send({ produtoId: 'p-1', quantidade: 1 });

        const res = await request(app)
            .put(`/carrinho/${id}/itens/p-1`)
            .send({ quantidade: 4 });

        expect(res.status).toBe(200);
        expect(res.body.itens).toEqual([
            { produtoId: 'p-1', quantidade: 4, precoUnitario: 2000 }
        ]);
        expect(res.body.subtotal).toBe(8000);
    });

    it('PUT retorna 409 quando a nova quantidade excede o estoque', async () => {
        mockProdutos({ 'p-1': { preco: 2000, estoque: 2 } });

        const id = await criarCarrinho();
        // Adiciona 1 (dentro do estoque) e depois tenta subir para 5.
        await request(app).post(`/carrinho/${id}/itens`).send({ produtoId: 'p-1', quantidade: 1 });

        const res = await request(app)
            .put(`/carrinho/${id}/itens/p-1`)
            .send({ quantidade: 5 });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ erro: 'Estoque insuficiente' });
    });

    it('PUT retorna 404 para item inexistente no carrinho', async () => {
        const id = await criarCarrinho();
        const res = await request(app)
            .put(`/carrinho/${id}/itens/p-x`)
            .send({ quantidade: 1 });

        expect(res.status).toBe(404);
    });

    it('DELETE remove um item (200)', async () => {
        mockProdutos({ 'p-1': { preco: 1000, estoque: 10 } });

        const id = await criarCarrinho();
        await request(app).post(`/carrinho/${id}/itens`).send({ produtoId: 'p-1', quantidade: 2 });

        const res = await request(app).delete(`/carrinho/${id}/itens/p-1`);

        expect(res.status).toBe(200);
        expect(res.body.itens).toEqual([]);
        expect(res.body.subtotal).toBe(0);
    });

    it('DELETE item retorna 404 quando o item não está no carrinho', async () => {
        const id = await criarCarrinho();
        const res = await request(app).delete(`/carrinho/${id}/itens/p-x`);
        expect(res.status).toBe(404);
    });

    it('DELETE /carrinho/:id/itens limpa todos os itens (200)', async () => {
        mockProdutos({ 'p-1': { preco: 1000, estoque: 10 } });

        const id = await criarCarrinho();
        await request(app).post(`/carrinho/${id}/itens`).send({ produtoId: 'p-1', quantidade: 2 });

        const res = await request(app).delete(`/carrinho/${id}/itens`);

        expect(res.status).toBe(200);
        expect(res.body.itens).toEqual([]);
        expect(res.body.subtotal).toBe(0);
        expect(res.body.total).toBe(0);
    });

    it('DELETE limpar retorna 404 para carrinho inexistente', async () => {
        const res = await request(app).delete('/carrinho/c-naoexiste/itens');
        expect(res.status).toBe(404);
    });
});
