// Testes baseados em propriedades (PBT) do módulo puro de frete (frete.js).
//
// Implementa as Propriedades 5 e 6 da seção Correctness Properties do design,
// exercitando diretamente as funções puras e determinísticas de frete.js
// (sem rede/HTTP), com fast-check e no mínimo 100 iterações (numRuns: 100).
//
// frete.js é CommonJS; carregamos via createRequire para interoperar com ESM
// (padrão dos demais testes deste serviço).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fc from 'fast-check';

const require = createRequire(import.meta.url);
const {
  normalizarCep,
  cepValido,
  calcularFrete,
  FRETE_FAIXA_BAIXA,
  FRETE_FAIXA_MEDIA,
  FRETE_FAIXA_ALTA,
  LIMITE_FRETE_GRATIS
} = require('./frete');

/**
 * Insere um hífen numa posição arbitrária (interna) de uma string de dígitos.
 * Usado para provar que a presença de hífen não altera o resultado do frete.
 */
function inserirHifen(digitos, posicao) {
  const p = posicao % (digitos.length + 1);
  return digitos.slice(0, p) + '-' + digitos.slice(p);
}

// Feature: ecommerce-microservices, Property 5: Cálculo de frete determinístico por CEP e subtotal
describe('Propriedade 5: Cálculo de frete determinístico por CEP e subtotal', () => {
  // CEP válido: exatamente 8 dígitos (como string).
  const cepDigitosArb = fc
    .array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 8 })
    .map((ds) => ds.join(''));

  // Subtotal arbitrário não negativo (centavos), cobrindo abaixo e acima do
  // limite de frete grátis.
  const subtotalArb = fc.nat({ max: 200_000 });

  // Posição de inserção do hífen (prova de independência do hífen).
  const posicaoHifenArb = fc.nat({ max: 8 });

  it('segue as faixas de frete e a regra de frete grátis; hífen não altera o resultado', () => {
    fc.assert(
      fc.property(cepDigitosArb, subtotalArb, posicaoHifenArb, (cep, subtotal, posicao) => {
        const frete = calcularFrete(cep, subtotal);

        // Resultado esperado conforme Requisitos 4.1–4.5.
        let esperado;
        if (subtotal > LIMITE_FRETE_GRATIS) {
          esperado = 0;
        } else {
          const d = Number(cep[0]);
          if (d <= 3) {
            esperado = FRETE_FAIXA_BAIXA;
          } else if (d <= 6) {
            esperado = FRETE_FAIXA_MEDIA;
          } else {
            esperado = FRETE_FAIXA_ALTA;
          }
        }
        expect(frete).toBe(esperado);

        // Hífen não altera o resultado (determinismo após normalização).
        const cepComHifen = inserirHifen(cep, posicao);
        expect(calcularFrete(cepComHifen, subtotal)).toBe(frete);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: ecommerce-microservices, Property 6: Validação de CEP exige exatamente 8 dígitos
describe('Propriedade 6: Validação de CEP exige exatamente 8 dígitos', () => {
  // Strings que, após remover hífen e espaços, NÃO têm exatamente 8 dígitos.
  // Geramos strings arbitrárias e filtramos as que normalizam para 8 dígitos.
  const cepInvalidoArb = fc
    .oneof(
      // Dígitos com comprimento != 8 (inclui vazio), possivelmente com hífens/espaços.
      fc
        .array(fc.integer({ min: 0, max: 9 }), { minLength: 0, maxLength: 15 })
        .map((ds) => ds.join(''))
        .filter((s) => s.length !== 8),
      // Strings arbitrárias (podem conter letras/símbolos).
      fc.string()
    )
    // Garante que, após normalização, não haja exatamente 8 dígitos.
    .filter((s) => normalizarCep(s).length !== 8);

  it('recusa qualquer CEP sem exatamente 8 dígitos após normalização', () => {
    fc.assert(
      fc.property(cepInvalidoArb, (cep) => {
        // cepValido deve ser falso.
        expect(cepValido(cep)).toBe(false);
        // calcularFrete deve lançar erro de validação.
        expect(() => calcularFrete(cep, 0)).toThrow('CEP inválido');
      }),
      { numRuns: 100 }
    );
  });

  it('aceita qualquer CEP com exatamente 8 dígitos (com ou sem hífen)', () => {
    const cepValidoArb = fc
      .array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 8 })
      .map((ds) => ds.join(''));

    fc.assert(
      fc.property(cepValidoArb, fc.nat({ max: 8 }), (cep, posicao) => {
        expect(cepValido(cep)).toBe(true);
        const cepComHifen = cep.slice(0, posicao) + '-' + cep.slice(posicao);
        expect(cepValido(cepComHifen)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
