// Testes de pagamento simulado e gestão de status (tarefa 6.6) —
// POST /pedidos/:id/pagamento.
//
// server.js, carrinhoClient.js e produtosClient.js são CommonJS carregados via
// createRequire (fora do grafo de módulos ESM do Vitest). Mockamos o
// `global.fetch` que os clientes usam para observar a limpeza do carrinho
// (DELETE /carrinho/:id/itens) e a devolução de estoque
// (POST /produtos/:id/devolver), sem precisar dos serviços reais em execução.
//
// Cobre: aprovado -> PAGO + carrinho limpo; recusado -> PAGAMENTO_RECUSADO +
// estoque devolvido por item; 404 para pedido inexistente; 400 para `aprovado`
// não booleano; 409 quando o pedido já não está PENDENTE; e a imutabilidade do
// snapshot. (Requisitos 7.1, 7.2, 7.3, 7.4, 7.5, 7.7)
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('./server');
const { criarPedido, STATUS } = require('./pedido');
const store = app.store;
const prontidao = app.prontidao;

const realFetch = global.fetch;
const CARRINHO_URL = 'http://carrinho:3002';
const PRODUTOS_URL = 'http://produtos:3001';

/**
 * Cria um pedido PENDENTE com dois itens no snapshot, semeado no store.
 */
function pedidoPendente(overrides = {}) {
    return criarPedido({
        id: 'o-pag001',
        carrinhoId: 'c-111',
        comprador: { nome: 'Maria', cep: '01001000', endereco: 'Rua A', numero: '100' },
        itens: [
            { produtoId: 'p-ab12cd', nome: 'Notebook', precoUnitario: 350000, quantidade: 2, atributos: { cor: 'prata' } },
            { produtoId: 'p-ef34gh', nome: 'Mouse', precoUnitario: 5000, quantidade: 3, atributos: {} }
        ],
        subtotal: 715000,
        frete: 0,
        status: STATUS.PENDENTE,
        data: '2024-01-01T12:00:00.000Z',
        ...overrides
    });
}

/**
 * Instala um mock de global.fetch que registra as limpezas de carrinho
 * (DELETE /carrinho/:id/itens) e as devoluções de estoque
 * (POST /produtos/:id/devolver).
 *
 * @param {{ falharRede?: boolean }} [opts]
 * @returns {{ limpezas: Array, devolucoes: Array }}
 */
function mockFetch(opts = {}) {
    const limpezas = [];
    const devolucoes = [];
    global.fetch = vi.fn(async (url, init) => {
        if (opts.falharRede) {
            throw new Error('ECONNREFUSED');
        }
        const u = String(url);
        const metodo = (init && init.method) || 'GET';

        // DELETE /carrinho/:id/itens
        const limparMatch = u.match(/\/carrinho\/([^/]+)\/itens$/);
        if (limparMatch && metodo === 'DELETE') {
            limpezas.push(limparMatch[1]);
            return new Response(JSON.stringify({ id: limparMatch[1], itens: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // POST /produtos/:id/devolver
        const devolverMatch = u.match(/\/produtos\/([^/]+)\/devolver$/);
        if (devolverMatch && metodo === 'POST') {
            const corpo = init && init.body ? JSON.parse(init.body) : {};
            devolucoes.push({ produtoId: devolverMatch[1], quantidade: corpo.quantidade });
            return new Response(JSON.stringify({ id: devolverMatch[1] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        throw new Error(`URL não mockada: ${metodo} ${u}`);
    });
    return { limpezas, devolucoes };
}

describe('POST /pedidos/:id/pagamento — pagamento simulado (tarefa 6.6)', () => {
    beforeAll(async () => {
        await prontidao;
        process.env.CARRINHO_URL = CARRINHO_URL;
        process.env.PRODUTOS_URL = PRODUTOS_URL;
    });

    beforeEach(async () => {
        await store.save([pedidoPendente()]);
    });

    afterEach(() => {
        global.fetch = realFetch;
    });

    afterAll(async () => {
        await store.save([]);
        global.fetch = realFetch;
    });

    it('aprovado=true -> status PAGO e limpa o carrinho (DELETE /carrinho/:id/itens)', async () => {
        const { limpezas, devolucoes } = mockFetch();

        const res = await request(app)
            .post('/pedidos/o-pag001/pagamento')
            .send({ aprovado: true });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('PAGO');
        // Carrinho associado foi limpo exatamente uma vez.
        expect(limpezas).toEqual(['c-111']);
        // Nenhuma devolução de estoque em pagamento aprovado.
        expect(devolucoes).toEqual([]);
        // Persistiu a mudança de status.
        expect(store.getAll()[0].status).toBe('PAGO');
    });

    it('aprovado=false -> status PAGAMENTO_RECUSADO e devolve o estoque de cada item', async () => {
        const { limpezas, devolucoes } = mockFetch();

        const res = await request(app)
            .post('/pedidos/o-pag001/pagamento')
            .send({ aprovado: false });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('PAGAMENTO_RECUSADO');
        // Nenhuma limpeza de carrinho em pagamento recusado.
        expect(limpezas).toEqual([]);
        // Devolveu a quantidade reservada de cada item do snapshot.
        expect(devolucoes).toEqual([
            { produtoId: 'p-ab12cd', quantidade: 2 },
            { produtoId: 'p-ef34gh', quantidade: 3 }
        ]);
        expect(store.getAll()[0].status).toBe('PAGAMENTO_RECUSADO');
    });

    it('o snapshot de itens não é alterado pelo pagamento (Requisito 7.7)', async () => {
        mockFetch();

        const res = await request(app)
            .post('/pedidos/o-pag001/pagamento')
            .send({ aprovado: true });

        expect(res.status).toBe(200);
        expect(res.body.itens).toEqual([
            { produtoId: 'p-ab12cd', nome: 'Notebook', precoUnitario: 350000, quantidade: 2, atributos: { cor: 'prata' } },
            { produtoId: 'p-ef34gh', nome: 'Mouse', precoUnitario: 5000, quantidade: 3, atributos: {} }
        ]);
        expect(res.body.subtotal).toBe(715000);
        expect(res.body.total).toBe(715000);
    });

    it('retorna 404 para pedido inexistente', async () => {
        mockFetch();

        const res = await request(app)
            .post('/pedidos/o-zzz999/pagamento')
            .send({ aprovado: true });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ erro: 'Pedido não encontrado' });
    });

    it('retorna 400 quando "aprovado" não é booleano', async () => {
        mockFetch();

        const res = await request(app)
            .post('/pedidos/o-pag001/pagamento')
            .send({ aprovado: 'sim' });

        expect(res.status).toBe(400);
        expect(res.body.erro).toMatch(/aprovado/i);
        // Pedido permanece PENDENTE.
        expect(store.getAll()[0].status).toBe('PENDENTE');
    });

    it('retorna 400 quando "aprovado" está ausente', async () => {
        mockFetch();

        const res = await request(app)
            .post('/pedidos/o-pag001/pagamento')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.erro).toMatch(/aprovado/i);
    });

    it('retorna 409 quando o pedido já não está PENDENTE (evita duplo processamento)', async () => {
        await store.save([pedidoPendente({ status: STATUS.PAGO })]);
        const { limpezas, devolucoes } = mockFetch();

        const res = await request(app)
            .post('/pedidos/o-pag001/pagamento')
            .send({ aprovado: true });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ erro: 'Pedido não está pendente' });
        // Nenhum efeito colateral.
        expect(limpezas).toEqual([]);
        expect(devolucoes).toEqual([]);
        expect(store.getAll()[0].status).toBe('PAGO');
    });

    it('mantém o pedido PAGO mesmo se a limpeza do carrinho falhar (best-effort)', async () => {
        mockFetch({ falharRede: true });

        const res = await request(app)
            .post('/pedidos/o-pag001/pagamento')
            .send({ aprovado: true });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('PAGO');
        expect(store.getAll()[0].status).toBe('PAGO');
    });
});
