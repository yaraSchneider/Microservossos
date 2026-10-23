// Testes de exemplo do módulo puro de frete (frete.js) e da rota
// POST /carrinho/:id/frete. Os testes de propriedade dedicados (Prop. 5 e 6)
// ficam em tarefas separadas (4.7 e 4.8).
//
// server.js e frete.js são CommonJS; carregamos via createRequire para
// interoperar com ESM (padrão dos demais testes deste serviço).
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const { normalizarCep, cepValido, calcularFrete } = require('./frete');
const app = require('./server');
const store = app.store;
const prontidao = app.prontidao;

describe('frete.js (módulo puro)', () => {
    it('normaliza CEP removendo hífen e espaços', () => {
        expect(normalizarCep('01001-000')).toBe('01001000');
        expect(normalizarCep(' 010 010 00 ')).toBe('01001000');
    });

    it('valida CEP com exatamente 8 dígitos', () => {
        expect(cepValido('01001-000')).toBe(true);
        expect(cepValido('0100100')).toBe(false); // 7 dígitos
        expect(cepValido('010010000')).toBe(false); // 9 dígitos
        expect(cepValido('abcdefgh')).toBe(false);
    });

    it('calcula frete por faixa do primeiro dígito', () => {
        expect(calcularFrete('01001000', 0)).toBe(1500); // 0–3
        expect(calcularFrete('40000000', 0)).toBe(2500); // 4–6
        expect(calcularFrete('70000000', 0)).toBe(3500); // 7–9
    });

    it('aplica frete grátis quando subtotal > 50000, sobrepondo o CEP', () => {
        expect(calcularFrete('70000000', 50001)).toBe(0);
        expect(calcularFrete('01001000', 60000)).toBe(0);
    });

    it('não é afetado pelo hífen', () => {
        expect(calcularFrete('01001-000', 0)).toBe(calcularFrete('01001000', 0));
    });
});

describe('POST /carrinho/:id/frete', () => {
    beforeEach(async () => {
        await prontidao;
        await store.save([]);
    });

    async function semearCarrinho(itens) {
        const carrinho = { id: 'c-frete01', itens, cep: null, frete: 0, subtotal: 0, total: 0 };
        await store.save([carrinho]);
        return carrinho;
    }

    it('calcula frete 1500 para CEP 01001-000', async () => {
        await semearCarrinho([{ produtoId: 'p-1', quantidade: 1, precoUnitario: 1000 }]);
        const res = await request(app)
            .post('/carrinho/c-frete01/frete')
            .send({ cep: '01001-000' });
        expect(res.status).toBe(200);
        expect(res.body.frete).toBe(1500);
        expect(res.body.cep).toBe('01001000');
        expect(res.body.total).toBe(res.body.subtotal + 1500);
    });

    it('calcula frete 2500 para faixa 4–6 e 3500 para 7–9', async () => {
        await semearCarrinho([]);
        const r1 = await request(app).post('/carrinho/c-frete01/frete').send({ cep: '40000000' });
        expect(r1.body.frete).toBe(2500);
        const r2 = await request(app).post('/carrinho/c-frete01/frete').send({ cep: '70000000' });
        expect(r2.body.frete).toBe(3500);
    });

    it('aplica frete grátis quando subtotal > 50000', async () => {
        await semearCarrinho([{ produtoId: 'p-1', quantidade: 1, precoUnitario: 60000 }]);
        const res = await request(app)
            .post('/carrinho/c-frete01/frete')
            .send({ cep: '70000000' });
        expect(res.status).toBe(200);
        expect(res.body.frete).toBe(0);
    });

    it('retorna 400 para CEP inválido', async () => {
        await semearCarrinho([]);
        const res = await request(app)
            .post('/carrinho/c-frete01/frete')
            .send({ cep: '123' });
        expect(res.status).toBe(400);
        expect(res.body.erro).toBe('CEP inválido');
    });

    it('retorna 404 para carrinho inexistente', async () => {
        const res = await request(app)
            .post('/carrinho/c-naoexiste/frete')
            .send({ cep: '01001000' });
        expect(res.status).toBe(404);
        expect(res.body.erro).toBe('Carrinho não encontrado');
    });
});
