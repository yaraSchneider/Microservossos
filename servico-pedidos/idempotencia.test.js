// Testes de idempotência da finalização (tarefa 6.3) — POST /pedidos.
//
// Mesma abordagem dos demais testes do Serviço_Pedidos: server.js e os clientes
// HTTP (carrinhoClient/produtosClient) são CommonJS carregados via createRequire
// e conversam com os serviços de backend por `global.fetch`, que mockamos aqui.
//
// Cobre (Requisito 6.5):
//  - Repetir a finalização do MESMO carrinho não cria pedido duplicado nem
//    reserva estoque novamente: a 1ª tentativa retorna 201 e a 2ª retorna 200
//    com o MESMO id do pedido existente (reservar chamado uma única vez).
//  - Um cabeçalho `Idempotency-Key` customizado é honrado como chave.
//  - Um pedido anterior com status PAGAMENTO_RECUSADO NÃO bloqueia uma nova
//    finalização do mesmo carrinho (nova tentativa cria um novo pedido, 201).
//
// A Propriedade 9 (PBT dedicado da idempotência) é a tarefa 6.5 — não aqui.
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
 * @returns {{ reservas: Array }}
 */
function mockFetch(cenario) {
    const reservas = [];
    global.fetch = vi.fn(async (url, init) => {
        const u = String(url);
        const metodo = (init && init.method) || 'GET';

        const carrinhoMatch = u.match(/\/carrinho\/([^/]+)$/);
        if (carrinhoMatch && u.startsWith(CARRINHO_URL)) {
            return new Response(JSON.stringify(cenario.carrinho), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const reservarMatch = u.match(/\/produtos\/([^/]+)\/reservar$/);
        if (reservarMatch && metodo === 'POST') {
            const id = reservarMatch[1];
            const corpo = init && init.body ? JSON.parse(init.body) : {};
            reservas.push({ produtoId: id, quantidade: corpo.quantidade });
            return new Response(
                JSON.stringify({ id, estoque: cenario.produtos[id].estoque - corpo.quantidade }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

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

const COMPRADOR = {
    nome: 'Maria',
    cep: '01001000',
    endereco: 'Rua A',
    numero: '100',
    complemento: 'Apto 5'
};

describe('POST /pedidos — idempotência da finalização (tarefa 6.3, Requisito 6.5)', () => {
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

    it('duas finalizações do mesmo carrinho: 201 e depois 200 com o mesmo pedido, reservando o estoque uma única vez', async () => {
        const cenario = cenarioPadrao();
        const { reservas } = mockFetch(cenario);

        const primeira = await request(app)
            .post('/pedidos')
            .send({ carrinhoId: 'c-111', comprador: COMPRADOR });

        const segunda = await request(app)
            .post('/pedidos')
            .send({ carrinhoId: 'c-111', comprador: COMPRADOR });

        // Primeira cria (201); segunda é duplicata idempotente (200).
        expect(primeira.status).toBe(201);
        expect(segunda.status).toBe(200);

        // Retornam exatamente o mesmo pedido.
        expect(segunda.body.id).toBe(primeira.body.id);
        expect(segunda.body).toEqual(primeira.body);

        // Reserva de estoque ocorreu uma única vez no total.
        expect(reservas).toEqual([{ produtoId: 'p-ab12cd', quantidade: 2 }]);

        // Apenas um pedido persistido.
        expect(store.getAll()).toHaveLength(1);
    });

    it('honra um cabeçalho Idempotency-Key customizado como chave de idempotência', async () => {
        const cenario = cenarioPadrao();
        const { reservas } = mockFetch(cenario);

        const primeira = await request(app)
            .post('/pedidos')
            .set('Idempotency-Key', 'chave-custom-1')
            .send({ carrinhoId: 'c-111', comprador: COMPRADOR });

        const segunda = await request(app)
            .post('/pedidos')
            .set('Idempotency-Key', 'chave-custom-1')
            .send({ carrinhoId: 'c-111', comprador: COMPRADOR });

        expect(primeira.status).toBe(201);
        expect(primeira.body.chaveIdempotencia).toBe('chave-custom-1');
        expect(segunda.status).toBe(200);
        expect(segunda.body.id).toBe(primeira.body.id);
        expect(reservas).toEqual([{ produtoId: 'p-ab12cd', quantidade: 2 }]);
        expect(store.getAll()).toHaveLength(1);
    });

    it('pedido anterior com status PAGAMENTO_RECUSADO não bloqueia uma nova finalização (cria novo pedido, 201)', async () => {
        const cenario = cenarioPadrao();
        const { reservas } = mockFetch(cenario);

        // Pré-condição: já existe um pedido do mesmo carrinho, porém recusado.
        const recusado = criarPedido({
            carrinhoId: 'c-111',
            comprador: COMPRADOR,
            itens: [
                { produtoId: 'p-ab12cd', nome: 'Notebook', precoUnitario: 350000, quantidade: 2, atributos: { cor: 'prata' } }
            ],
            subtotal: 700000,
            frete: 1500,
            total: 701500,
            status: STATUS.PAGAMENTO_RECUSADO
        });
        await store.save([recusado]);

        const res = await request(app)
            .post('/pedidos')
            .send({ carrinhoId: 'c-111', comprador: COMPRADOR });

        // Recusa anterior não bloqueia: nova finalização cria um novo pedido.
        expect(res.status).toBe(201);
        expect(res.body.id).not.toBe(recusado.id);
        expect(res.body.status).toBe('PENDENTE');

        // Nova reserva foi realizada para o novo pedido.
        expect(reservas).toEqual([{ produtoId: 'p-ab12cd', quantidade: 2 }]);

        // Agora há dois pedidos: o recusado e o novo PENDENTE.
        expect(store.getAll()).toHaveLength(2);
    });
});
