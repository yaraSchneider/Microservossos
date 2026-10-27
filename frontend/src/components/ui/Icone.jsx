// ---------------------------------------------------------------------------
// Icone
//
// Conjunto pequeno de ícones em traço (SVG inline, 24×24) usados pela
// interface. Herdam a cor do texto (`currentColor`).
// ---------------------------------------------------------------------------

const CAMINHOS = {
    sacola: (
        <>
            <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
            <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
        </>
    ),
    busca: (
        <>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
        </>
    ),
    mais: <path d="M12 5v14M5 12h14" />,
    lapis: (
        <>
            <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
            <path d="m13.5 6.5 4 4" />
        </>
    ),
    lixeira: (
        <>
            <path d="M4 7h16M10 11v6M14 11v6" />
            <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
            <path d="M9 7V4h6v3" />
        </>
    ),
    voltar: <path d="M15 5l-7 7 7 7" />,
    seguir: <path d="M9 5l7 7-7 7" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    fechar: <path d="M6 6l12 12M18 6 6 18" />,
    cabide: (
        <>
            <path d="M12 8.5a2 2 0 1 1 2-2" />
            <path d="M12 8.5v1L3 16.5a1 1 0 0 0 .6 1.8h16.8a1 1 0 0 0 .6-1.8L12 9.5" />
        </>
    ),
    folha: (
        <>
            <path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" />
            <path d="M5 19 13 11" />
        </>
    ),
    caminhao: (
        <>
            <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
            <circle cx="7" cy="17.5" r="1.8" />
            <circle cx="17" cy="17.5" r="1.8" />
        </>
    ),
    etiqueta: (
        <>
            <path d="M3 12V4h8l10 10-8 8L3 12Z" />
            <circle cx="7.5" cy="8.5" r="1.3" />
        </>
    ),
    caixa: (
        <>
            <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
            <path d="M3 7.5 12 12l9-4.5M12 12v9" />
        </>
    ),
    olho: (
        <>
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="2.8" />
        </>
    ),
    grade: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
};

/**
 * @param {object} props
 * @param {keyof typeof CAMINHOS} props.nome Nome do ícone.
 * @param {number} [props.tamanho] Lado em pixels (padrão 20).
 * @param {string} [props.className]
 */
export default function Icone({ nome, tamanho = 20, className = '' }) {
    return (
        <svg
            className={`icone ${className}`.trim()}
            width={tamanho}
            height={tamanho}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {CAMINHOS[nome]}
        </svg>
    );
}
