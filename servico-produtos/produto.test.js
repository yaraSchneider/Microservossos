// Testes unitários do modelo de Produto e validação (produto.js).
//
// Cobre a validação (Requisito 1.9), a normalização de atributos dinâmicos
// (Requisitos 1.8) e a construção de um Produto com id único (Requisito 1.1).
// O teste de propriedade de preço em centavos é a tarefa opcional 2.2.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// produto.js é CommonJS; carrega via createRequire para interoperar com ESM.
const require = createRequire(import.meta.url);
const {
  validarProduto,
  criarProduto,
  normalizarAtributos
} = require('./produto');

const entradaValida = () => ({
  nome: 'Notebook',
  descricao: 'Notebook 14 polegadas',
  categoria: 'Eletrônicos',
  preco: 350000,
  estoque: 12,
  imagemUrl: 'https://exemplo/img.png',
  atributos: { cor: 'prata', voltagem: 'bivolt' }
});

describe('validarProduto', () => {
  it('aceita um produto válido e normaliza os campos', () => {
    const r = validarProduto(entradaValida());
    expect(r.valido).toBe(true);
    expect(r.produto).toMatchObject({
      nome: 'Notebook',
      descricao: 'Notebook 14 polegadas',
      categoria: 'Eletrônicos',
      preco: 350000,
      estoque: 12,
      imagemUrl: 'https://exemplo/img.png',
      atributos: { cor: 'prata', voltagem: 'bivolt' }
    });
    // Não deve atribuir id (isso é responsabilidade de criarProduto).
    expect(r.produto.id).toBeUndefined();
  });

  it('faz trim do nome', () => {
    const r = validarProduto({ ...entradaValida(), nome: '  Mouse  ' });
    expect(r.valido).toBe(true);
    expect(r.produto.nome).toBe('Mouse');
  });

  it('rejeita nome vazio com "Nome é obrigatório"', () => {
    const r = validarProduto({ ...entradaValida(), nome: '   ' });
    expect(r).toEqual({ valido: false, erro: 'Nome é obrigatório' });
  });

  it('rejeita nome ausente', () => {
    const entrada = entradaValida();
    delete entrada.nome;
    expect(validarProduto(entrada)).toEqual({
      valido: false,
      erro: 'Nome é obrigatório'
    });
  });

  it('rejeita preço não numérico com "Preço inválido"', () => {
    const r = validarProduto({ ...entradaValida(), preco: 'abc' });
    expect(r).toEqual({ valido: false, erro: 'Preço inválido' });
  });

  it('rejeita preço negativo', () => {
    const r = validarProduto({ ...entradaValida(), preco: -1 });
    expect(r).toEqual({ valido: false, erro: 'Preço inválido' });
  });

  it('rejeita preço não inteiro (float)', () => {
    const r = validarProduto({ ...entradaValida(), preco: 10.5 });
    expect(r).toEqual({ valido: false, erro: 'Preço inválido' });
  });

  it('aceita preço zero', () => {
    const r = validarProduto({ ...entradaValida(), preco: 0 });
    expect(r.valido).toBe(true);
    expect(r.produto.preco).toBe(0);
  });

  it('rejeita estoque negativo com "Estoque não pode ser negativo"', () => {
    const r = validarProduto({ ...entradaValida(), estoque: -3 });
    expect(r).toEqual({ valido: false, erro: 'Estoque não pode ser negativo' });
  });

  it('rejeita estoque não inteiro', () => {
    const r = validarProduto({ ...entradaValida(), estoque: 2.7 });
    expect(r).toEqual({ valido: false, erro: 'Estoque não pode ser negativo' });
  });

  it('aceita estoque zero', () => {
    const r = validarProduto({ ...entradaValida(), estoque: 0 });
    expect(r.valido).toBe(true);
    expect(r.produto.estoque).toBe(0);
  });

  it('usa defaults para campos opcionais ausentes', () => {
    const r = validarProduto({ nome: 'Teclado', preco: 15000, estoque: 20 });
    expect(r.valido).toBe(true);
    expect(r.produto).toMatchObject({
      descricao: '',
      categoria: '',
      imagemUrl: '',
      atributos: {}
    });
  });

  it('rejeita entrada que não é objeto', () => {
    expect(validarProduto(null).valido).toBe(false);
    expect(validarProduto('x').valido).toBe(false);
    expect(validarProduto([]).valido).toBe(false);
  });
});

describe('normalizarAtributos', () => {
  it('retorna {} para entradas inválidas', () => {
    expect(normalizarAtributos(undefined)).toEqual({});
    expect(normalizarAtributos(null)).toEqual({});
    expect(normalizarAtributos('x')).toEqual({});
    expect(normalizarAtributos([1, 2])).toEqual({});
  });

  it('converte valores para string e ignora nulos', () => {
    const r = normalizarAtributos({ cor: 'prata', peso: 2, ausente: null });
    expect(r).toEqual({ cor: 'prata', peso: '2' });
  });
});

describe('criarProduto', () => {
  it('cria um produto com id único no formato "p-xxxxxx"', () => {
    const r = criarProduto(entradaValida());
    expect(r.valido).toBe(true);
    expect(r.produto.id).toMatch(/^p-[0-9a-f]{6}$/);
  });

  it('gera ids distintos em chamadas sucessivas', () => {
    const a = criarProduto(entradaValida());
    const b = criarProduto(entradaValida());
    expect(a.produto.id).not.toBe(b.produto.id);
  });

  it('permite injetar um id (para testes)', () => {
    const r = criarProduto(entradaValida(), { id: 'p-ab12cd' });
    expect(r.produto.id).toBe('p-ab12cd');
  });

  it('repassa o erro de validação sem criar produto', () => {
    const r = criarProduto({ ...entradaValida(), nome: '' });
    expect(r).toEqual({ valido: false, erro: 'Nome é obrigatório' });
  });
});
