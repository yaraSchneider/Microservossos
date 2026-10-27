// ---------------------------------------------------------------------------
// Aviso de "sacola alterada"
//
// As telas que mexem no carrinho disparam este evento para que o contador da
// sacola no cabeçalho se atualize sem precisar de um estado global.
// ---------------------------------------------------------------------------

const EVENTO = 'garimpo:sacola-atualizada';

/** Notifica que o conteúdo da sacola mudou. */
export function avisarSacolaAtualizada() {
    window.dispatchEvent(new Event(EVENTO));
}

/**
 * Inscreve um callback para mudanças na sacola.
 * @param {() => void} callback
 * @returns {() => void} Função para cancelar a inscrição.
 */
export function aoAtualizarSacola(callback) {
    window.addEventListener(EVENTO, callback);
    return () => window.removeEventListener(EVENTO, callback);
}
