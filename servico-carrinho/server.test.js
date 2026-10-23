// Testes do CRUD básico do carrinho (tarefa 4.1).
// Verifica POST /carrinho (201, id + itens vazio), GET /carrinho/:id (200)
// e GET de id inexistente (404 { erro }).
//
// server.js é CommonJS; carrega via createRequire para interoperar com ESM.
// O app persiste em data/carrinhos.json; resetamos o store para [] antes de
// cada teste e ao final da suíte para não poluir o arquivo real.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('./server');
const store = app.store;
const prontidao = app.prontidao;

describe('Serviço_Carrinho — CRUD básico (tarefa 4.1)', () => {
    beforeAll(async () => {
        await prontidao;
    });

    beforeEach(async () => {
        await store.save([]);
    });

    afterAll(async () => {
        await store.save([]);
    });

    it('POST /carrinho cria um carrinho vazio e retorna 201 com id e itens []', async () => {
        const res = await request(app).post('/carrinho').send();

        expect(res.status).toBe(201);
        expect(typeof res.body.id).toBe('string');
        expect(res.body.id).toMatch(/^c-[0-9a-f]{6}$/);
        expect(res.body.itens).toEqual([]);
        expect(res.body.cep).toBe(null);
        expect(res.body.frete).toBe(0);
        expect(res.body.subtotal).toBe(0);
        expect(res.body.total).toBe(0);
    });

    it('GET /carrinho/:id retorna 200 com o carrinho criado', async () => {
        const criado = await request(app).post('/carrinho').send();
        const { id } = criado.body;

        const res = await request(app).get(`/carrinho/${id}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(id);
        expect(res.body.itens).toEqual([]);
    });

    it('GET /carrinho/:id retorna 404 { erro } para id inexistente', async () => {
        const res = await request(app).get('/carrinho/c-inexistente');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ erro: 'Carrinho não encontrado' });
    });

    it('GET /health retorna 200 { status: "ok" } (tarefa 4.9)', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
    });
});
