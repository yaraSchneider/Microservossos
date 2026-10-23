// ---------------------------------------------------------------------------
// Botao
//
// Botão reutilizável com estado de carregamento/desabilitado. Quando
// `carregando` é verdadeiro, exibe um spinner embutido e fica desabilitado.
// (Requisito 11.8)
// ---------------------------------------------------------------------------

import Loading from './Loading.jsx';

/**
 * @param {object} props
 * @param {boolean} [props.carregando] Exibe spinner e desabilita o botão.
 * @param {boolean} [props.disabled] Desabilita o botão.
 * @param {'primario'|'secundario'|'perigo'} [props.variante] Estilo visual.
 * @param {React.ReactNode} props.children Rótulo do botão.
 */
export default function Botao({
    carregando = false,
    disabled = false,
    variante = 'primario',
    children,
    className = '',
    ...resto
}) {
    return (
        <button
            className={`botao botao--${variante} ${className}`.trim()}
            disabled={carregando || disabled}
            aria-busy={carregando}
            {...resto}
        >
            {carregando && <Loading inline />}
            <span>{children}</span>
        </button>
    );
}
