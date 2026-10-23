// ---------------------------------------------------------------------------
// Loading / Spinner
//
// Indicador de carregamento reutilizável para operações dependentes de
// backend. (Requisito 11.8)
// ---------------------------------------------------------------------------

/**
 * Spinner com rótulo opcional.
 *
 * @param {object} props
 * @param {string} [props.texto] Texto exibido ao lado do spinner.
 * @param {boolean} [props.inline] Renderiza em linha (ex.: dentro de um botão).
 */
export default function Loading({ texto = 'Carregando...', inline = false }) {
    if (inline) {
        return <span className="spinner spinner--inline" aria-hidden="true" />;
    }

    return (
        <div className="loading" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>{texto}</span>
        </div>
    );
}
