// ---------------------------------------------------------------------------
// IlustracaoPeca
//
// Silhueta da peça em SVG, pintada com a cor cadastrada. Substitui a foto
// quando a peça não tem `imagemUrl` (ou a imagem falha), para que a vitrine
// continue bonita mesmo sem fotos.
// ---------------------------------------------------------------------------

import { CORES } from '../../utils/peca.js';

// Silhuetas por categoria (viewBox 200×240). `cabide` indica se a peça é
// desenhada pendurada.
const SILHUETAS = {
    Camisetas: {
        cabide: true,
        corpo: 'M70 62 L50 70 L26 98 L46 116 L62 104 L62 204 L138 204 L138 104 L154 116 L174 98 L150 70 L130 62 Q100 86 70 62 Z',
        detalhes: 'M70 62 Q100 86 130 62',
    },
    'Camisas & Blusas': {
        cabide: true,
        corpo: 'M72 62 L50 72 L30 152 L48 156 L64 102 L64 206 L136 206 L136 102 L152 156 L170 152 L150 72 L128 62 L100 80 Z',
        detalhes: 'M72 62 L88 86 L100 80 L112 86 L128 62 M100 80 V206',
        botoes: [104, 128, 152, 176],
    },
    Tricôs: {
        cabide: true,
        corpo: 'M70 62 L46 72 L26 162 L46 168 L64 106 L64 198 L136 198 L136 106 L154 168 L174 162 L154 72 L130 62 Q100 82 70 62 Z',
        detalhes:
            'M64 186 H136 M76 186 V198 M88 186 V198 M100 186 V198 M112 186 V198 M124 186 V198 M29 152 L48 158 M171 152 L152 158 M70 62 Q100 82 130 62',
    },
    'Jaquetas & Casacos': {
        cabide: true,
        corpo: 'M68 62 L44 72 L24 166 L44 172 L62 108 L62 210 L138 210 L138 108 L156 172 L176 166 L156 72 L132 62 L100 74 Z',
        detalhes: 'M68 62 L90 118 L100 108 L110 118 L132 62 M100 108 V210 M72 150 H88 M112 150 H128',
    },
    Vestidos: {
        cabide: true,
        corpo: 'M78 62 L72 66 L70 104 Q82 112 78 124 L38 212 Q100 226 162 212 L122 124 Q118 112 130 104 L128 66 L122 62 Q100 80 78 62 Z',
        detalhes: 'M74 120 Q100 130 126 120 M78 62 Q100 80 122 62',
    },
    Calças: {
        cabide: true,
        corpo: 'M62 66 L138 66 L148 218 L110 218 L100 114 L90 218 L52 218 Z',
        detalhes: 'M62 80 H138 M100 80 V114 M70 80 Q76 96 90 92',
    },
    Saias: {
        cabide: true,
        corpo: 'M72 70 L128 70 L160 198 Q100 212 40 198 Z',
        detalhes: 'M72 82 H128 M86 82 L74 202 M114 82 L126 202',
    },
    Shorts: {
        cabide: true,
        corpo: 'M60 70 L140 70 L150 156 L106 156 L100 114 L94 156 L50 156 Z',
        detalhes: 'M60 84 H140 M100 84 V114',
    },
    Calçados: {
        cabide: false,
        corpo: 'M36 158 L36 112 Q36 100 50 100 L84 100 Q96 128 124 132 L160 138 Q178 142 178 160 L178 172 L36 172 Z',
        detalhes: 'M36 160 H178 M60 100 V118 M70 100 V118 M84 110 L98 104',
    },
    Acessórios: {
        cabide: false,
        corpo: 'M50 104 L150 104 L162 204 L38 204 Z',
        detalhes: 'M74 104 Q74 56 100 56 Q126 56 126 104 M50 124 H150',
    },
};

/** Clareia/escurece um hex (#rrggbb) por um fator (-1..1). */
function ajustarCor(hex, fator) {
    const n = Number.parseInt(hex.slice(1), 16);
    const canal = (deslocamento) => {
        const c = (n >> deslocamento) & 255;
        const alvo = fator < 0 ? 0 : 255;
        return Math.round(c + (alvo - c) * Math.abs(fator));
    };
    return `rgb(${canal(16)}, ${canal(8)}, ${canal(0)})`;
}

/**
 * @param {object} props
 * @param {string} [props.categoria] Categoria do produto.
 * @param {string} [props.cor] Chave de cor (CORES) ou valor livre.
 */
export default function IlustracaoPeca({ categoria, cor }) {
    const silhueta = SILHUETAS[categoria] || SILHUETAS.Camisetas;
    const corInfo = CORES[cor] || CORES.mostarda;
    const estampado = corInfo.hex === 'estampa';
    const base = estampado ? '#c97a52' : corInfo.hex;
    // Id do <pattern> por categoria; repetições na página têm conteúdo
    // idêntico, então reutilizar o mesmo id é inofensivo.
    const idEstampa = `estampa-${(categoria || 'x').replace(/\W/g, '')}`;

    return (
        <svg className="ilustracao-peca" viewBox="0 0 200 240" aria-hidden="true">
            {estampado && (
                <defs>
                    <pattern id={idEstampa} width="22" height="22" patternUnits="userSpaceOnUse">
                        <rect width="22" height="22" fill={base} />
                        <circle cx="6" cy="6" r="3" fill="#f3e2c4" />
                        <circle cx="17" cy="16" r="2.2" fill="#5f7045" />
                        <circle cx="17" cy="5" r="1.2" fill="#f3e2c4" />
                    </pattern>
                </defs>
            )}

            {silhueta.cabide && (
                <g className="ilustracao-peca__cabide">
                    <path d="M100 34 a7 7 0 1 1 7 -7" />
                    <path d="M100 34 V38 L46 64 H154 L100 38" />
                </g>
            )}

            <path
                d={silhueta.corpo}
                fill={estampado ? `url(#${idEstampa})` : base}
                stroke={ajustarCor(base, -0.35)}
                strokeWidth="2.5"
                strokeLinejoin="round"
            />
            <path
                d={silhueta.detalhes}
                fill="none"
                stroke={ajustarCor(base, -0.3)}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.75"
            />
            {silhueta.botoes?.map((y) => (
                <circle key={y} cx="106" cy={y} r="2.6" fill={ajustarCor(base, 0.55)} />
            ))}
        </svg>
    );
}
