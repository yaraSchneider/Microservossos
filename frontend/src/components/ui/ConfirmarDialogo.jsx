// ---------------------------------------------------------------------------
// ConfirmarDialogo
//
// Modal de confirmação para ações destrutivas (ex.: excluir uma peça do
// acervo). Substitui o window.confirm nativo por um diálogo com a cara da
// loja. Fecha com Esc ou clique fora; foca o botão "Cancelar" ao abrir.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import Botao from './Botao.jsx';

/**
 * @param {object} props
 * @param {boolean} props.aberto
 * @param {string} props.titulo
 * @param {React.ReactNode} props.children Texto explicativo.
 * @param {string} [props.rotuloConfirmar]
 * @param {boolean} [props.carregando]
 * @param {() => void} props.onConfirmar
 * @param {() => void} props.onCancelar
 */
export default function ConfirmarDialogo({
    aberto,
    titulo,
    children,
    rotuloConfirmar = 'Confirmar',
    carregando = false,
    onConfirmar,
    onCancelar,
}) {
    const cancelarRef = useRef(null);
    // Refs para o handler de Esc ler sempre os valores atuais sem re-registrar
    // (e sem roubar o foco a cada renderização do pai).
    const estadoRef = useRef({ carregando, onCancelar });
    estadoRef.current = { carregando, onCancelar };

    useEffect(() => {
        if (!aberto) {
            return undefined;
        }
        cancelarRef.current?.focus();
        function aoTeclar(evento) {
            if (evento.key === 'Escape' && !estadoRef.current.carregando) {
                estadoRef.current.onCancelar();
            }
        }
        document.addEventListener('keydown', aoTeclar);
        return () => document.removeEventListener('keydown', aoTeclar);
    }, [aberto]);

    if (!aberto) {
        return null;
    }

    return (
        <div
            className="dialogo__fundo"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !carregando) onCancelar();
            }}
        >
            <div
                className="dialogo"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="dialogo-titulo"
                aria-describedby="dialogo-texto"
            >
                <h2 id="dialogo-titulo" className="dialogo__titulo">
                    {titulo}
                </h2>
                <div id="dialogo-texto" className="dialogo__texto">
                    {children}
                </div>
                <div className="dialogo__acoes">
                    <button
                        ref={cancelarRef}
                        type="button"
                        className="botao botao--secundario"
                        onClick={onCancelar}
                        disabled={carregando}
                    >
                        <span>Cancelar</span>
                    </button>
                    <Botao variante="perigo" onClick={onConfirmar} carregando={carregando}>
                        {rotuloConfirmar}
                    </Botao>
                </div>
            </div>
        </div>
    );
}
