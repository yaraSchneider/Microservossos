// ---------------------------------------------------------------------------
// Mensagem (sucesso / erro / informação)
//
// Componente para exibir o resultado final de operações dependentes de
// backend. (Requisito 11.8)
// ---------------------------------------------------------------------------

/**
 * Exibe uma mensagem contextual.
 *
 * @param {object} props
 * @param {'sucesso'|'erro'|'info'} [props.tipo] Variante visual.
 * @param {React.ReactNode} props.children Conteúdo da mensagem.
 * @param {() => void} [props.onFechar] Se fornecido, exibe um botão de fechar.
 */
export default function Mensagem({ tipo = 'info', children, onFechar }) {
    if (!children) {
        return null;
    }

    const papel = tipo === 'erro' ? 'alert' : 'status';

    return (
        <div className={`mensagem mensagem--${tipo}`} role={papel} aria-live="polite">
            <span className="mensagem__texto">{children}</span>
            {onFechar && (
                <button
                    type="button"
                    className="mensagem__fechar"
                    onClick={onFechar}
                    aria-label="Fechar mensagem"
                >
                    ×
                </button>
            )}
        </div>
    );
}
