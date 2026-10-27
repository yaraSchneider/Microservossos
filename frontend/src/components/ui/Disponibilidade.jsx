// ---------------------------------------------------------------------------
// Disponibilidade
//
// No brechó quase toda peça é única, então a disponibilidade fala a língua
// da loja:
//   estoque  = 1 -> "Peça única"
//   estoque  > 1 -> "N disponíveis"
//   estoque <= 0 -> "Vendida"
// ---------------------------------------------------------------------------

/**
 * Texto de disponibilidade para um estoque.
 * @param {number} estoque
 * @returns {string}
 */
export function textoDisponibilidade(estoque) {
    const qtd = Number(estoque) || 0;
    if (qtd <= 0) return 'Vendida';
    if (qtd === 1) return 'Peça única';
    return `${qtd} disponíveis`;
}

/**
 * @param {object} props
 * @param {number} props.estoque Quantidade em estoque.
 */
export default function Disponibilidade({ estoque }) {
    const esgotado = (Number(estoque) || 0) <= 0;
    return (
        <span
            className={`disponibilidade ${esgotado ? 'disponibilidade--esgotado' : 'disponibilidade--disponivel'}`}
        >
            {textoDisponibilidade(estoque)}
        </span>
    );
}
