// Testes de consulta/listagem de pedidos (tarefa 6.1).
//
// Cobrem os endpoints GET /pedidos e GET /pedidos/:id com dados semeados
// diretamente no store, além do helper de modelo criarPedido. Os valores
// permanecem em centavos. (Requisitos 8.1, 8.2, 8.3)
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import app from './server.js';
import { criarPedido, STATUS, gerarId } from './pedido.js';

const store = app.store;

const pedidoA = criarPedido({
    id: 'o-aaa111',
    carrinhoId: 'c-111',
    comprador: { nome: 'Maria', cep: '01001000', endereco: 'Rua A', numero: '100' },
    itens: [
        {
            produtoId: 'p-ab12cd',
            nome: 'Notebook',
            precoUnitario: 350000,
            quantidade: 2,
            atributos: { cor: 'prata' }
        }
    ],
    subtotal: 700000,
    frete: 0,
    data: '2024-01-01T12:00:00.000Z'
});

const pedidoB = criarPedido({
    id: 'o-bbb222',
    carrinhoId: 'c-222',
    comprador: { nome: 'João', cep: '70000000', endereco: 'Rua B', numero: '50' },
    itens: [
        { produtoId: 'p-ef34gh', nome: 'Mouse', precoUnitario: 5000, quantidade: 3, atributos: {} }
    ],
    subtotal: 15000,
    frete: 3500,
    status: STATUS.PAGO,
    data: '2024-02-02T10:00:00.000Z'
});

beforeEach(async () => {
    await app.prontidao;
    await store.save([pedidoA, pedidoB]);
});

describe('modelo de Pedido (pedido.js)', () => {
    it('gera ids com prefixo "o-" e snapshot imutável dos itens', () => {
        expect(gerarId()).toMatch(/^o-[0-9a-f]{6}$/);

        const original = [{ produtoId: 'p-1', nome: 'X', precoUnitario: 100, quantidade: 1, atributos: { a: '1' } }];
        const pedido = criarPedido({ carrinhoId: 'c-x', comprador: {}, itens: original, subtotal: 100 });

        // Mutar a lista original não afeta o snapshot do pedido.
        original[0].precoUnitario = 999;
        expect(pedido.itens[0].precoUnitario).toBe(100);
        expect(pedido.status).toBe('PENDENTE');
        expect(pedido.total).toBe(100);
        expect(pedido.chaveIdempotencia).toBe('c-x');
    });
});

describe('GET /pedidos', () => {
    it('retorna a lista com id, data, total e status', async () => {
        const res = await request(app).get('/pedidos');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body).toEqual([
            { id: 'o-aaa111', data: '2024-01-01T12:00:00.000Z', total: 700000, status: 'PENDENTE' },
            { id: 'o-bbb222', data: '2024-02-02T10:00:00.000Z', total: 18500, status: 'PAGO' }
        ]);
    });
});

describe('GET /pedidos/:id', () => {
    it('retorna o pedido completo com snapshot (200)', async () => {
        const res = await request(app).get('/pedidos/o-aaa111');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe('o-aaa111');
        expect(res.body.itens).toHaveLength(1);
        expect(res.body.itens[0]).toMatchObject({
            produtoId: 'p-ab12cd',
            nome: 'Notebook',
            precoUnitario: 350000,
            quantidade: 2
        });
        expect(res.body.comprador.nome).toBe('Maria');
    });

    it('retorna 404 para id inexistente', async () => {
        const res = await request(app).get('/pedidos/o-zzz999');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ erro: 'Pedido não encontrado' });
    });
});
