// Utilitário de persistência compartilhado (store.js)
//
// Módulo replicado por serviço — cada serviço opera exclusivamente sobre o
// próprio Arquivo_JSON, sem acesso cruzado. Dados de outros serviços devem ser
// obtidos via REST.
//
// Características (Requisito 9):
//  - Auto-criação do arquivo com estado inicial [] quando ausente (9.1).
//  - Leitura do conteúdo em memória no start; arquivo vazio assume [] .
//  - Gravação atômica serializada: fila sequencial (uma por vez); escreve em
//    <arquivo>.json.tmp e faz rename atômico sobre o arquivo final (9.2).
//  - Acesso exclusivo ao próprio arquivo do serviço (9.4, 9.5).
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

/**
 * Cria um store de persistência para um único arquivo JSON.
 *
 * @param {string} filePath Caminho do Arquivo_JSON do serviço.
 * @returns {{
 *   init: () => Promise<Array>,
 *   getAll: () => Array,
 *   read: () => Array,
 *   save: (data: Array) => Promise<Array>,
 *   write: (data: Array) => Promise<Array>,
 *   filePath: string
 * }}
 */
function createStore(filePath) {
    if (typeof filePath !== 'string' || filePath.length === 0) {
        throw new Error('createStore requer um filePath válido');
    }

    const tmpPath = filePath + '.tmp';

    // Estado mantido em memória.
    let state = [];
    let initialized = false;

    // Fila de gravação: garante que as gravações aconteçam uma por vez,
    // evitando escritas concorrentes sobre o mesmo arquivo.
    let writeChain = Promise.resolve();

    function ensureDirSync() {
        const dir = path.dirname(filePath);
        if (dir && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    function parseContent(raw) {
        // Arquivo vazio (ou só espaços) assume [].
        if (raw == null || raw.trim() === '') {
            return [];
        }
        const parsed = JSON.parse(raw);
        return parsed;
    }

    // Executa a gravação atômica efetiva: escreve no temporário e renomeia.
    async function atomicWrite(data) {
        ensureDirSync();
        const serialized = JSON.stringify(data, null, 2);
        await fsp.writeFile(tmpPath, serialized, 'utf8');
        // rename é atômico no mesmo sistema de arquivos: o arquivo final nunca
        // fica num estado parcial/corrompido. Em alguns sistemas (notadamente
        // Windows), o `rename` pode falhar de forma transitória com EPERM/
        // EACCES/EBUSY quando o arquivo de destino está momentaneamente
        // bloqueado (antivírus/indexador). Essas falhas são transitórias e não
        // indicam corrupção, então aplicamos um pequeno retry com backoff. O
        // estado final persistido permanece idêntico.
        await renameComRetry(tmpPath, filePath);
    }

    // Retry curto e limitado para o rename final, cobrindo bloqueios
    // transitórios do sistema de arquivos sem alterar o resultado.
    async function renameComRetry(from, to, tentativas = 10, atrasoMs = 20) {
        for (let i = 0; i < tentativas; i++) {
            try {
                await fsp.rename(from, to);
                return;
            } catch (err) {
                const transitorio =
                    err &&
                    (err.code === 'EPERM' ||
                        err.code === 'EACCES' ||
                        err.code === 'EBUSY');
                if (!transitorio || i === tentativas - 1) {
                    throw err;
                }
                await new Promise((resolve) => setTimeout(resolve, atrasoMs));
            }
        }
    }

    /**
     * Inicializa o store: cria o arquivo com [] se ausente e carrega o
     * conteúdo em memória. Idempotente.
     */
    async function init() {
        ensureDirSync();
        let raw;
        try {
            raw = await fsp.readFile(filePath, 'utf8');
        } catch (err) {
            if (err.code === 'ENOENT') {
                // Arquivo não existe: cria com estado inicial [] de forma atômica.
                state = [];
                await atomicWrite(state);
                initialized = true;
                return state;
            }
            throw err;
        }
        state = parseContent(raw);
        initialized = true;
        return state;
    }

    /**
     * Retorna o estado atual mantido em memória.
     */
    function getAll() {
        return state;
    }

    /**
     * Grava um novo estado de forma serializada e atômica, atualizando a
     * cópia em memória ao concluir. Chamadas concorrentes são enfileiradas.
     *
     * @param {Array} data Novo estado a persistir.
     */
    function save(data) {
        // Encadeia na fila: cada save só começa após o anterior terminar.
        const result = writeChain.then(async () => {
            await atomicWrite(data);
            state = data;
            return state;
        });

        // Mantém a fila avançando mesmo que uma gravação falhe, sem deixar a
        // promise de erro sem tratamento na cadeia interna.
        writeChain = result.then(
            () => undefined,
            () => undefined
        );

        return result;
    }

    return {
        init,
        getAll,
        // Aliases de conveniência mencionados no design/guidance.
        read: getAll,
        save,
        write: save,
        filePath
    };
}

module.exports = { createStore };
