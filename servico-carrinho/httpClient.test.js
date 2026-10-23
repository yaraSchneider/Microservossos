// Testes de unidade do cliente HTTP resiliente (httpClient.js), tarefa 8.1.
//
// Verificam a política de retry/backoff:
//  - repete e sucede quando uma falha de conexão é transitória;
//  - repete em 5xx e devolve a resposta final;
//  - esgotadas as tentativas numa falha de conexão, relança o erro;
//  - NÃO repete em respostas 2xx ou 4xx (definitivas).
//
// (Requisitos 10.1, 10.3, 10.4, 12.6)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { fetchComRetry } = require('./httpClient');

const realFetch = global.fetch;

function resposta(status) {
    return { ok: status >= 200 && status < 300, status, json: async () => ({}) };
}

const cfgRapida = { tentativas: 3, backoffMs: 1 };

describe('fetchComRetry', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = realFetch;
        vi.restoreAllMocks();
    });

    it('repete após falha de conexão transitória e sucede', async () => {
        global.fetch
            .mockRejectedValueOnce(new Error('ECONNREFUSED'))
            .mockResolvedValueOnce(resposta(200));

        const res = await fetchComRetry('http://x/recurso', undefined, cfgRapida);

        expect(res.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('esgota as tentativas e relança o erro de conexão', async () => {
        global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

        await expect(
            fetchComRetry('http://x/recurso', undefined, cfgRapida)
        ).rejects.toThrow(/ECONNREFUSED/);
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('repete em 5xx e devolve a última resposta', async () => {
        global.fetch
            .mockResolvedValueOnce(resposta(503))
            .mockResolvedValueOnce(resposta(200));

        const res = await fetchComRetry('http://x/recurso', undefined, cfgRapida);

        expect(res.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('não repete em resposta 2xx (apenas uma chamada)', async () => {
        global.fetch.mockResolvedValue(resposta(200));

        const res = await fetchComRetry('http://x/recurso', undefined, cfgRapida);

        expect(res.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('não repete em respostas 4xx (definitivas)', async () => {
        for (const status of [400, 404, 409]) {
            global.fetch.mockReset().mockResolvedValue(resposta(status));
            const res = await fetchComRetry('http://x/recurso', undefined, cfgRapida);
            expect(res.status).toBe(status);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        }
    });
});
