// ---------------------------------------------------------------------------
// Gerenciamento do carrinhoId no navegador
//
// O `carrinhoId` é armazenado no `localStorage`. Se ainda não existir, o
// Frontend cria um carrinho vazio (POST /api/carrinho) e guarda o id
// retornado. (Design: "Estado do carrinho")
// ---------------------------------------------------------------------------

import { carrinho } from '../services/api.js';

const CHAVE = 'carrinhoId';

/**
 * Lê o carrinhoId atual do localStorage, se existir.
 * @returns {string|null}
 */
export function getCarrinhoId() {
    try {
        return localStorage.getItem(CHAVE);
    } catch {
        return null;
    }
}

/**
 * Grava o carrinhoId no localStorage.
 * @param {string} id
 */
function setCarrinhoId(id) {
    try {
        localStorage.setItem(CHAVE, id);
    } catch {
        // Ambiente sem localStorage (ex.: SSR) — ignora silenciosamente.
    }
}

/**
 * Remove o carrinhoId do localStorage (ex.: após finalizar uma compra para
 * iniciar um novo carrinho na próxima interação).
 */
export function resetCarrinhoId() {
    try {
        localStorage.removeItem(CHAVE);
    } catch {
        // ignora
    }
}

// Evita criações concorrentes caso múltiplos componentes chamem ao mesmo tempo.
let criacaoEmAndamento = null;

/**
 * Obtém o carrinhoId existente ou cria um novo carrinho no backend.
 *
 * - Se houver um id no localStorage, retorna-o diretamente.
 * - Caso contrário, cria um carrinho via POST /api/carrinho, persiste o id
 *   retornado no localStorage e o retorna.
 *
 * @returns {Promise<string>} O carrinhoId garantidamente disponível.
 */
export async function obterOuCriarCarrinhoId() {
    const existente = getCarrinhoId();
    if (existente) {
        return existente;
    }

    // Reutiliza uma criação já em andamento para não duplicar carrinhos.
    if (!criacaoEmAndamento) {
        criacaoEmAndamento = carrinho
            .criar()
            .then((novo) => {
                const id = novo && novo.id;
                if (!id) {
                    throw new Error('Não foi possível criar o carrinho.');
                }
                setCarrinhoId(id);
                return id;
            })
            .finally(() => {
                criacaoEmAndamento = null;
            });
    }

    return criacaoEmAndamento;
}

export default obterOuCriarCarrinhoId;
