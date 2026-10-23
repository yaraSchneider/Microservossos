// Testes do utilitário de persistência compartilhado (store.js).
//
// Inclui o teste de propriedade da Propriedade 10 (gravação atômica preserva
// JSON íntegro) usando fast-check com numRuns: 100.
import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

// store.js é CommonJS; carrega via createRequire para interoperar com ESM.
const require = createRequire(import.meta.url);
const { createStore } = require('./store');

// Diretórios temporários criados durante os testes, removidos no afterEach.
const tempDirs = [];

function makeTempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-pbt-'));
  tempDirs.push(dir);
  return path.join(dir, 'dados.json');
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignora falhas de limpeza.
    }
  }
});

describe('store.save - gravação atômica', () => {
  // Feature: ecommerce-microservices, Property 10: Gravação atômica preserva JSON íntegro
  it('Propriedade 10: após cada gravação concluída o arquivo é JSON válido e reflete estado consistente', async () => {
    // Gerador de um "estado" arbitrário: um array de dados JSON-serializáveis.
    const estadoArb = fc.array(
      fc.record({
        id: fc.string(),
        valor: fc.oneof(
          fc.integer(),
          fc.string(),
          fc.boolean(),
          fc.constant(null),
          fc.array(fc.integer(), { maxLength: 5 }),
          fc.dictionary(fc.string(), fc.integer(), { maxKeys: 4 })
        ),
      }),
      { maxLength: 8 }
    );

    await fc.assert(
      fc.asyncProperty(
        // Uma sequência arbitrária (não vazia) de estados a gravar.
        fc.array(estadoArb, { minLength: 1, maxLength: 12 }),
        async (sequencia) => {
          const filePath = makeTempFile();
          const store = createStore(filePath);
          await store.init();

          // Aplica a sequência de gravações, serializadas pela fila do store.
          // Após CADA gravação concluída, lê o arquivo de disco e verifica que
          // é sempre JSON válido/parseável e igual ao estado recém-gravado.
          for (const estado of sequencia) {
            await store.save(estado);

            const raw = await fsp.readFile(filePath, 'utf8');
            // Precisa ser JSON parseável (nunca parcial/corrompido).
            const lido = JSON.parse(raw);
            // Reflete um estado consistente: exatamente o estado concluído.
            expect(lido).toStrictEqual(estado);
            // E o estado em memória acompanha o último gravado.
            expect(store.getAll()).toStrictEqual(estado);
          }

          // Após toda a sequência, o arquivo final reflete o último estado.
          const finalRaw = await fsp.readFile(filePath, 'utf8');
          expect(JSON.parse(finalRaw)).toStrictEqual(sequencia[sequencia.length - 1]);

          // Não deve restar arquivo temporário após gravações concluídas.
          expect(fs.existsSync(filePath + '.tmp')).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  // Feature: ecommerce-microservices, Property 10: Gravação atômica preserva JSON íntegro
  it('Propriedade 10 (concorrência): gravações concorrentes são serializadas e o arquivo final é sempre JSON válido', async () => {
    const estadoArb = fc.array(fc.record({ n: fc.integer() }), { maxLength: 6 });

    await fc.assert(
      fc.asyncProperty(
        fc.array(estadoArb, { minLength: 2, maxLength: 10 }),
        async (sequencia) => {
          const filePath = makeTempFile();
          const store = createStore(filePath);
          await store.init();

          // Dispara todas as gravações "ao mesmo tempo"; a fila interna deve
          // serializá-las. Aguardamos a conclusão de todas.
          await Promise.all(sequencia.map((estado) => store.save(estado)));

          // O arquivo precisa ser JSON válido e refletir UM dos estados
          // gravados (o último concluído na fila sequencial).
          const raw = await fsp.readFile(filePath, 'utf8');
          const lido = JSON.parse(raw);
          const algumEstadoBate = sequencia.some(
            (estado) => JSON.stringify(estado) === JSON.stringify(lido)
          );
          expect(algumEstadoBate).toBe(true);

          // Como a fila é sequencial, o estado final é o último da sequência.
          expect(lido).toStrictEqual(sequencia[sequencia.length - 1]);
          expect(fs.existsSync(filePath + '.tmp')).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
