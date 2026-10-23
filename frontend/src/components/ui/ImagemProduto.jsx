// ---------------------------------------------------------------------------
// ImagemProduto
//
// Exibe a imagem do produto (`imagemUrl`). Quando a URL está ausente ou a
// imagem falha ao carregar, mostra um placeholder amigável.
// ---------------------------------------------------------------------------

import { useState } from 'react';

/**
 * @param {object} props
 * @param {string} [props.src] URL da imagem (imagemUrl).
 * @param {string} props.alt Texto alternativo (nome do produto).
 * @param {string} [props.className] Classe adicional.
 */
export default function ImagemProduto({ src, alt, className = '' }) {
    const [falhou, setFalhou] = useState(false);
    const semImagem = !src || falhou;

    if (semImagem) {
        return (
            <div
                className={`imagem-produto imagem-produto--placeholder ${className}`.trim()}
                role="img"
                aria-label={alt ? `Sem imagem: ${alt}` : 'Sem imagem'}
            >
                <span aria-hidden="true">🛍️</span>
                <span className="imagem-produto__legenda">Sem imagem</span>
            </div>
        );
    }

    return (
        <img
            className={`imagem-produto ${className}`.trim()}
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFalhou(true)}
        />
    );
}
