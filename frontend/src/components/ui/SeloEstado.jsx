// ---------------------------------------------------------------------------
// SeloEstado
//
// Selo do estado de conservação da peça (Nova com etiqueta, Seminova,
// Vintage...). Não renderiza nada quando o estado não foi informado.
// ---------------------------------------------------------------------------

import { ESTADOS, rotuloEstado } from '../../utils/peca.js';

/**
 * @param {object} props
 * @param {string} [props.estado] Chave de ESTADOS ou texto livre.
 */
export default function SeloEstado({ estado }) {
    if (!estado) {
        return null;
    }
    const modificador = ESTADOS[estado] ? estado : 'livre';
    return <span className={`selo-estado selo-estado--${modificador}`}>{rotuloEstado(estado)}</span>;
}
