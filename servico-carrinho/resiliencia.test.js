// Testes de integração de resiliência (tarefa 8.2) — Serviço_Carrinho.
//
// Verificam, no nível do endpoint HTTP (via supertest + mock de global.fetch),
// o comportamento quando o Serviço_Produtos está indisponível e durante a
// ordem de inicialização dos contêineres:
//  - Produtos desligado (fetch lança) -> POST /carrinho/:id/itens retorna 503
//    com mensagem amigável (Requisito 10.3).
//  - "Retry durante a inicialização": o produtos lança nas primeiras
//    tentativas (como um contêiner que ainda não subiu) e responde em seguida;
//    o retry do cliente HTTP faz a requisição eventualmente ter sucesso (201),
//    sem derrubar o processo requisitante (Requisito 12.6).
//
// server.js e produtosClient.js são CommonJS carregados via createRequire (fora
// do grafo ESM do Vitest); mockamos o `global.fetch` usado pelo cliente real,
// exercitando o caminho de ponta a ponta sem um Serviço_Produtos em execução.
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('./server');
const store = app.store;
const prontidao = app.prontidao;

const realFetch = global.fetch;

/**
 * Responde às rotas do Serviço_Produtos para um único produto disponível.
 * @param {string} url
 */
function responderProdutoDisponivel(url) {
    const u = String(url);
    if (/\/produtos\/([^/]+)\/estoque$/.test(u)) {
        return { ok: true, status: 200, json: async () => ({ id: 'p-1', estoque: 10 }) };
    }
    if (/\/produtos\/([^/]+)$/.test(u)) {
        return { ok: true, status: 200, json: async () => ({ id: 'p-1', preco: 1000, estoque: 10 }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
}

async function criarCarrinho() {
    const res = await request(app).post('/carrinho').send();
    return res.body.id;
}

describe('Serviço_Carrinho — resiliência e retry (tarefa 8.2)', () => {
    beforeAll(async () => {
        await prontidao;
    });

    beforeEach(async () => {
        await store.save([]);
    });

    afterEach(() => {
        global.fetch = realFetch;
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await store.save([]);
        global.fetch = realFetch;
    });

    it('produtos desligado -> POST /carrinho/:id/itens retorna 503 amigável', async () => {
        // fetch sempre lança: o Serviço_Produtos está completamente fora do ar.
        global.fetch = vi.fn(async () => {
            throw new Error('ECONNREFUSED');
        });

        const id = await criarCarrinho();
        const res = await request(app)
            .post(`/carrinho/${id}/itens`)
            .send({ produtoId: 'p-1', quantidade: 1 });

        expect(res.status).toBe(503);
        expect(res.body.erro).toMatch(/indispon/i);
        expect(res.body.erro).toMatch(/novamente/i);
    });

    it('retry durante a inicialização: produtos lança nas primeiras tentativas e depois responde -> 201', async () => {
        // Simula a ordem de inicialização: as duas primeiras chamadas falham
        // (contêiner de produtos ainda subindo) e as seguintes respondem. Com
        // 3 tentativas por chamada, obterProduto sucede na 3ª tentativa e as
        // chamadas seguintes (estoque) já encontram o serviço no ar.
        let chamadas = 0;
        global.fetch = vi.fn(async (url) => {
            chamadas += 1;
            if (chamadas <= 2) {
                throw new Error('ECONNREFUSED');
            }
            return responderProdutoDisponivel(url);
        });

        const id = await criarCarrinho();
        const res = await request(app)
            .post(`/carrinho/${id}/itens`)
            .send({ produtoId: 'p-1', quantidade: 1 });

        expect(res.status).toBe(201);
        expect(res.body.itens).toEqual([
            { produtoId: 'p-1', quantidade: 1, precoUnitario: 1000 }
        ]);
        // Confirma que houve mais de uma tentativa de fetch (retry ocorreu).
        expect(chamadas).toBeGreaterThan(2);
    });
});
