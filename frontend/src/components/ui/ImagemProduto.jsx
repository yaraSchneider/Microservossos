// ---------------------------------------------------------------------------
// ImagemProduto
//
// Exibe a foto da peça (`imagemUrl`). Quando a URL está ausente ou a imagem
// falha ao carregar, mostra a ilustração da peça pintada na cor cadastrada.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import IlustracaoPeca from './IlustracaoPeca.jsx';

/**
 * @param {object} props
 * @param {string} [props.src] URL da imagem (imagemUrl).
 * @param {string} props.alt Texto alternativo (nome da peça).
 * @param {string} [props.categoria] Categoria (define a silhueta).
 * @param {string} [props.cor] Cor da peça (pinta a silhueta).
 * @param {string} [props.className] Classe adicional.
 */
export default function ImagemProduto({ src, alt, categoria, cor, className = '' }) {
    const [falhou, setFalhou] = useState(false);

    // Uma nova URL (ex.: pré-visualização do formulário) merece nova tentativa.
    useEffect(() => {
        setFalhou(false);
    }, [src]);

    if (!src || falhou) {
        return (
            <div
                className={`imagem-produto imagem-produto--ilustracao ${className}`.trim()}
                role="img"
                aria-label={alt ? `Ilustração: ${alt}` : 'Peça sem foto'}
            >
                <IlustracaoPeca categoria={categoria} cor={cor} />
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
