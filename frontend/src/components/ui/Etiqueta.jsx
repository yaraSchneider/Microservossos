// ---------------------------------------------------------------------------
// Etiqueta de preço
//
// O preço aparece como a etiqueta de papel amarrada nas peças de brechó: valor
// "escrito à mão" e, quando houver, o preço original riscado e a economia.
// ---------------------------------------------------------------------------

import { formatarReais } from '../../utils/formato.js';
import { percentualEconomia } from '../../utils/peca.js';

/**
 * @param {object} props
 * @param {number} props.preco Preço em centavos.
 * @param {number|null} [props.precoOriginal] Preço de loja em centavos.
 * @param {'normal'|'grande'} [props.tamanho]
 */
export default function Etiqueta({ preco, precoOriginal = null, tamanho = 'normal' }) {
    const economia = percentualEconomia(preco, precoOriginal);

    return (
        <div className={`etiqueta etiqueta--${tamanho}`}>
            <span className="etiqueta__furo" aria-hidden="true" />
            <span className="etiqueta__preco">{formatarReais(preco)}</span>
            {economia !== null && (
                <span className="etiqueta__original">
                    <s aria-label={`Preço original ${formatarReais(precoOriginal)}`}>
                        {formatarReais(precoOriginal)}
                    </s>
                    <span className="etiqueta__economia">−{economia}%</span>
                </span>
            )}
        </div>
    );
}
