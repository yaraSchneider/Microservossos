// Testes de integração de resiliência (tarefa 8.2) — Serviço_Pedidos.
//
// Verificam, no nível do endpoint HTTP (via supertest + mock de global.fetch),
// o comportamento quando um serviço dependente está indisponível e durante a
// ordem de inicialização dos contêineres (Requisitos 10.3, 12.6):
//  - Serviço_Carrinho desligado -> POST /pedidos retorna 503 amigável.
//  - Serviço_Produtos desligado (carrinho no ar) -> POST /pedidos retorna 503
//    amigável durante a revalidação dos itens.
//  - "Retry durante a inicialização": o dependente lança nas primeiras
//    tentativas (como um contêiner que ainda não subiu) e responde em seguida;
//    o retry do cliente HTTP faz a finalização eventualmente ter sucesso (201),
//    sem derrubar o processo requisitante.
//
// server.js, carrinhoClient.js e produtosClient.js são CommonJS carregados via
// createRequire (fora do grafo ESM do Vitest); mockamos o `global.fetch` usado
// pelos clientes reais, exercitando o caminho de ponta a ponta sem os serviços
// dependentes em execução.
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

const CARRINHO = {
    id: 'c-res01',
    itens: [{ produtoId: 'p-res01', quantidade: 1, precoUnitario: 1000 }],
    cep: '01001000',
    frete: 1500,
    subtotal: 1000,
    total: 2500
};

const PRODUTO = {
    id: 'p-res01',
    nome: 'Produto Resiliência',
    preco: 1000,
    estoque: 10,
    atributos: {}
};

function respostaJson(corpo, status) {
    return new Response(JSON.stringify(corpo), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Responde às rotas do Serviço_Carrinho e Serviço_Produtos para o cenário
 * padrão (um carrinho com um item e um produto com estoque suficiente).
 *
 * @param {string} url
 * @param {object} [init]
 */
function responderServicos(url, init) {
    const u = String(url);
    const metodo = (init && init.method) || 'GET';

    // GET /carrinho/:id
    if (u.startsWith(CARRINHO_URL) && /\/carrinho\/([^/]+)$/.test(u)) {
        return respostaJson(CARRINHO, 200);
    }
    // POST /produtos/:id/reservar
    if (/\/produtos\/([^/]+)\/reservar$/.test(u) && metodo === 'POST') {
        return respostaJson({ id: PRODUTO.id, estoque: PRODUTO.estoque - 1 }, 200);
    }
    // GET /produtos/:id/estoque
    if (/\/produtos\/([^/]+)\/estoque$/.test(u)) {
        return respostaJson({ id: PRODUTO.id, estoque: PRODUTO.estoque }, 200);
    }
    // GET /produtos/:id
    if (/\/produtos\/([^/]+)$/.test(u)) {
        return respostaJson(PRODUTO, 200);
    }
    throw new Error(`URL não mockada: ${metodo} ${u}`);
}

const comprador = { nome: 'Ana', cep: '01001000', endereco: 'Rua R', numero: '1' };

describe('Serviço_Pedidos — resiliência e retry (tarefa 8.2)', () => {
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
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await store.save([]);
        global.fetch = realFetch;
    });

    it('carrinho desligado -> POST /pedidos retorna 503 amigável', async () => {
        // Toda chamada ao Serviço_Carrinho lança; o carrinho é o primeiro
        // dependente consultado na criação do pedido.
        global.fetch = vi.fn(async (url) => {
            if (String(url).startsWith(CARRINHO_URL)) {
                throw new Error('ECONNREFUSED');
            }
            return responderServicos(url);
        });

        const res = await request(app)
            .post('/pedidos')
            .send({ carrinhoId: CARRINHO.id, comprador });

        expect(res.status).toBe(503);
        expect(res.body.erro).toMatch(/indispon/i);
        expect(res.body.erro).toMatch(/novamente/i);
        expect(store.getAll()).toHaveLength(0);
    });

    it('produtos desligado (carrinho no ar) -> POST /pedidos retorna 503 amigável', async () => {
        // O carrinho responde normalmente, mas o Serviço_Produtos está fora do
        // ar durante a revalidação dos itens.
        global.fetch = vi.fn(async (url, init) => {
            if (String(url).startsWith(PRODUTOS_URL)) {
                throw new Error('ECONNREFUSED');
            }
            return responderServicos(url, init);
        });

        const res = await request(app)
            .post('/pedidos')
            .send({ carrinhoId: CARRINHO.id, comprador });

        expect(res.status).toBe(503);
        expect(res.body.erro).toMatch(/indispon/i);
        expect(res.body.erro).toMatch(/novamente/i);
        expect(store.getAll()).toHaveLength(0);
    });

    it('retry durante a inicialização: carrinho lança nas primeiras tentativas e depois responde -> 201', async () => {
        // Simula a ordem de inicialização: as duas primeiras chamadas (ao
        // carrinho) falham e as seguintes respondem. Com 3 tentativas por
        // chamada, obterCarrinho sucede e o fluxo completa a criação do pedido.
        let chamadas = 0;
        global.fetch = vi.fn(async (url, init) => {
            chamadas += 1;
            if (chamadas <= 2) {
                throw new Error('ECONNREFUSED');
            }
            return responderServicos(url, init);
        });

        const res = await request(app)
            .post('/pedidos')
            .send({ carrinhoId: CARRINHO.id, comprador });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('PENDENTE');
        expect(res.body.carrinhoId).toBe(CARRINHO.id);
        expect(res.body.itens).toEqual([
            {
                produtoId: 'p-res01',
                nome: 'Produto Resiliência',
                precoUnitario: 1000,
                quantidade: 1,
                atributos: {}
            }
        ]);
        expect(store.getAll()).toHaveLength(1);
        // Confirma que houve retry (mais de uma tentativa de fetch).
        expect(chamadas).toBeGreaterThan(2);
    });
});
