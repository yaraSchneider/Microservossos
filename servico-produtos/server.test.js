// Testes unitários (nível HTTP) do CRUD de produtos — tarefa 2.4.
//
// Exercita os endpoints do Serviço_Produtos via supertest sobre o app Express
// exportado por server.js:
//   GET    /produtos        -> lista (200)
//   POST   /produtos        -> cria (201 / 400)
//   GET    /produtos/:id    -> obtém (200 / 404)
//   PUT    /produtos/:id    -> edita (200 / 400 / 404)
//   DELETE /produtos/:id    -> exclui (204 / 404)
//
// Cobre criar/listar/obter/editar/excluir, 404 para id inexistente e as
// validações de cadastro (nome vazio, preço não numérico, estoque negativo).
// Requisitos: 1.3, 1.4, 1.5, 1.6, 1.7, 1.9.
//
// O app persiste em data/produtos.json (store criado no carregamento do
// módulo). Para não poluir o arquivo real, aguardamos `prontidao` e resetamos
// o store para [] antes de cada teste e ao final da suíte.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'node:module';

// server.js é CommonJS; carrega via createRequire para interoperar com ESM.
const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('./server');
const store = app.store;
const prontidao = app.prontidao;

// Payload válido de produto, reutilizado nos testes.
function produtoValido(overrides = {}) {
  return {
    nome: 'Notebook',
    descricao: '14 polegadas',
    categoria: 'Eletrônicos',
    preco: 350000,
    estoque: 12,
    imagemUrl: 'https://exemplo.com/img.png',
    atributos: { cor: 'prata', voltagem: 'bivolt' },
    ...overrides,
  };
}

beforeAll(async () => {
  // Garante que o store inicializou (arquivo criado/carregado) antes das reqs.
  await prontidao;
});

beforeEach(async () => {
  // Estado limpo e isolado por teste.
  await store.save([]);
});

afterAll(async () => {
  // Deixa data/produtos.json como [] ao final da suíte.
  await store.save([]);
});

describe('Health check (tarefa 2.8, Requisito 12.7)', () => {
  it('GET /health retorna 200 { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({ status: 'ok' });
  });
});

describe('CRUD de produtos (HTTP)', () => {
  it('POST /produtos cria um produto (201) com id e campos do corpo', async () => {
    const res = await request(app).post('/produtos').send(produtoValido());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nome: 'Notebook',
      descricao: '14 polegadas',
      categoria: 'Eletrônicos',
      preco: 350000,
      estoque: 12,
      imagemUrl: 'https://exemplo.com/img.png',
      atributos: { cor: 'prata', voltagem: 'bivolt' },
    });
    expect(typeof res.body.id).toBe('string');
    expect(res.body.id.length).toBeGreaterThan(0);
  });

  it('GET /produtos lista os produtos cadastrados (200) incluindo o criado', async () => {
    const criado = await request(app).post('/produtos').send(produtoValido());
    expect(criado.status).toBe(201);

    const res = await request(app).get('/produtos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(criado.body.id);
  });

  it('GET /produtos/:id retorna o produto por id existente (200)', async () => {
    const criado = await request(app).post('/produtos').send(produtoValido());

    const res = await request(app).get(`/produtos/${criado.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual(criado.body);
  });

  it('GET /produtos/:id retorna 404 { erro } para id inexistente', async () => {
    const res = await request(app).get('/produtos/p-inexistente');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('erro');
    expect(typeof res.body.erro).toBe('string');
  });

  it('PUT /produtos/:id atualiza o produto mantendo o mesmo id (200)', async () => {
    const criado = await request(app).post('/produtos').send(produtoValido());

    const res = await request(app)
      .put(`/produtos/${criado.body.id}`)
      .send(produtoValido({ nome: 'Notebook Pro', preco: 500000, estoque: 7 }));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(criado.body.id);
    expect(res.body.nome).toBe('Notebook Pro');
    expect(res.body.preco).toBe(500000);
    expect(res.body.estoque).toBe(7);

    // A alteração deve estar persistida/consultável.
    const obtido = await request(app).get(`/produtos/${criado.body.id}`);
    expect(obtido.body.nome).toBe('Notebook Pro');
  });

  it('PUT /produtos/:id retorna 404 { erro } para id inexistente', async () => {
    const res = await request(app)
      .put('/produtos/p-inexistente')
      .send(produtoValido());
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('erro');
  });

  it('PUT /produtos/:id retorna 400 { erro } para dados inválidos', async () => {
    const criado = await request(app).post('/produtos').send(produtoValido());

    const res = await request(app)
      .put(`/produtos/${criado.body.id}`)
      .send(produtoValido({ nome: '' }));

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('erro');
  });

  it('DELETE /produtos/:id remove o produto (204) e some da listagem', async () => {
    const criado = await request(app).post('/produtos').send(produtoValido());

    const res = await request(app).delete(`/produtos/${criado.body.id}`);
    expect(res.status).toBe(204);

    const obtido = await request(app).get(`/produtos/${criado.body.id}`);
    expect(obtido.status).toBe(404);

    const lista = await request(app).get('/produtos');
    expect(lista.body).toHaveLength(0);
  });

  it('DELETE /produtos/:id retorna 404 { erro } para id inexistente', async () => {
    const res = await request(app).delete('/produtos/p-inexistente');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('erro');
  });
});

describe('Validação no POST /produtos (Requisito 1.9)', () => {
  it('rejeita nome vazio com 400 "Nome é obrigatório"', async () => {
    const res = await request(app)
      .post('/produtos')
      .send(produtoValido({ nome: '' }));

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('Nome é obrigatório');
  });

  it('rejeita preço não numérico com 400 "Preço inválido"', async () => {
    const res = await request(app)
      .post('/produtos')
      .send(produtoValido({ preco: 'abc' }));

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('Preço inválido');
  });

  it('rejeita estoque negativo com 400 "Estoque não pode ser negativo"', async () => {
    const res = await request(app)
      .post('/produtos')
      .send(produtoValido({ estoque: -5 }));

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('Estoque não pode ser negativo');
  });
});
