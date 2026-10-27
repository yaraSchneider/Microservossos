// ---------------------------------------------------------------------------
// Logo do Garimpo
//
// Cabide desenhado à mão + marca nominativa. Usado no cabeçalho e no rodapé.
// ---------------------------------------------------------------------------

/** Símbolo: cabide com um pequeno losango (o "achado" do garimpo). */
export function SimboloCabide({ tamanho = 34 }) {
    return (
        <svg
            className="logo__simbolo"
            width={tamanho}
            height={tamanho}
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
        >
            <circle cx="24" cy="24" r="23" fill="var(--terracota)" />
            <path
                d="M24 15.5a3.2 3.2 0 1 1 3.2-3.2"
                stroke="var(--papel)"
                strokeWidth="2.4"
                strokeLinecap="round"
            />
            <path
                d="M24 15.5v1.8L10.6 28.6a1.4 1.4 0 0 0 .9 2.5h25a1.4 1.4 0 0 0 .9-2.5L24 17.3"
                stroke="var(--papel)"
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <path d="m24 33.5 2.6 2.6-2.6 2.6-2.6-2.6z" fill="var(--mostarda)" />
        </svg>
    );
}

/**
 * @param {object} props
 * @param {boolean} [props.claro] Versão para fundos escuros.
 */
export default function Logo({ claro = false }) {
    return (
        <span className={`logo ${claro ? 'logo--claro' : ''}`.trim()}>
            <SimboloCabide />
            <span className="logo__texto">
                <span className="logo__nome">Garimpo</span>
                <span className="logo__sufixo">brechó</span>
            </span>
        </span>
    );
}
