// Testes unitários do cálculo de subtotal e total (tarefa 4.2).
// Verifica calcularSubtotal/calcularValores (funções puras) e o recálculo
// retornado por GET /carrinho/:id quando o carrinho possui itens.
//
// O teste de propriedade dedicado (Propriedade 2) é a tarefa 4.3; aqui ficam
// apenas exemplos/bordas concretos. Valores em centavos (inteiros).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('./server');
const store = app.store;
const prontidao = app.prontidao;
const { calcularSubtotal, calcularValores } = require('./carrinho');

describe('Serviço_Carrinho — cálculo de subtotal e total (tarefa 4.2)', () => {
    describe('calcularSubtotal', () => {
        it('retorna 0 para lista vazia, undefined ou não-array', () => {
            expect(calcularSubtotal([])).toBe(0);
            expect(calcularSubtotal(undefined)).toBe(0);
            expect(calcularSubtotal(null)).toBe(0);
        });

        it('soma precoUnitario * quantidade de cada item', () => {
            const itens = [
                { produtoId: 'p-1', precoUnitario: 350000, quantidade: 2 },
                { produtoId: 'p-2', precoUnitario: 1500, quantidade: 3 }
            ];
            // 700000 + 4500 = 704500
            expect(calcularSubtotal(itens)).toBe(704500);
        });
    });

    describe('calcularValores', () => {
        it('total = subtotal quando frete ausente/não calculado (0)', () => {
            const carrinho = {
                id: 'c-abc123',
                itens: [{ produtoId: 'p-1', precoUnitario: 1000, quantidade: 2 }],
                cep: null,
                frete: 0
            };
            const r = calcularValores(carrinho);
            expect(r.subtotal).toBe(2000);
            expect(r.total).toBe(2000);
        });

        it('total = subtotal + frete quando frete calculado', () => {
            const carrinho = {
                id: 'c-abc123',
                itens: [{ produtoId: 'p-1', precoUnitario: 1000, quantidade: 2 }],
                cep: '01001000',
                frete: 1500
            };
            const r = calcularValores(carrinho);
            expect(r.subtotal).toBe(2000);
            expect(r.total).toBe(3500);
        });

        it('trata frete ausente (undefined) como 0', () => {
            const r = calcularValores({ itens: [], });
            expect(r.subtotal).toBe(0);
            expect(r.total).toBe(0);
        });

        it('não muta o carrinho original', () => {
            const carrinho = { id: 'c-1', itens: [{ precoUnitario: 10, quantidade: 1 }], frete: 0, subtotal: 0, total: 0 };
            calcularValores(carrinho);
            expect(carrinho.subtotal).toBe(0);
            expect(carrinho.total).toBe(0);
        });
    });

    describe('GET /carrinho/:id recomputa subtotal/total', () => {
        beforeAll(async () => {
            await prontidao;
        });

        beforeEach(async () => {
            await store.save([]);
        });

        afterAll(async () => {
            await store.save([]);
        });

        it('retorna subtotal/total recalculados a partir dos itens gravados', async () => {
            // Semeia diretamente um carrinho com itens (adição de itens é 4.4).
            const carrinho = {
                id: 'c-seed01',
                itens: [
                    { produtoId: 'p-1', precoUnitario: 350000, quantidade: 2 },
                    { produtoId: 'p-2', precoUnitario: 1500, quantidade: 3 }
                ],
                cep: '01001000',
                frete: 1500,
                subtotal: 0, // valor desatualizado propositalmente
                total: 0
            };
            await store.save([carrinho]);

            const res = await request(app).get('/carrinho/c-seed01');

            expect(res.status).toBe(200);
            expect(res.body.subtotal).toBe(704500);
            expect(res.body.total).toBe(706000); // 704500 + 1500
        });

        it('total = subtotal quando frete é 0 (não calculado)', async () => {
            const carrinho = {
                id: 'c-seed02',
                itens: [{ produtoId: 'p-1', precoUnitario: 2000, quantidade: 4 }],
                cep: null,
                frete: 0,
                subtotal: 0,
                total: 0
            };
            await store.save([carrinho]);

            const res = await request(app).get('/carrinho/c-seed02');

            expect(res.status).toBe(200);
            expect(res.body.subtotal).toBe(8000);
            expect(res.body.total).toBe(8000);
        });
    });
});
