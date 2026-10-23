// ---------------------------------------------------------------------------
// Disponibilidade
//
// Exibe a disponibilidade de estoque de um produto:
//   estoque > 0  -> "Em estoque (N)"
//   estoque <= 0 -> "Esgotado"
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {number} props.estoque Quantidade em estoque.
 */
export default function Disponibilidade({ estoque }) {
    const qtd = Number(estoque) || 0;
    const esgotado = qtd <= 0;

    return (
        <span
            className={`disponibilidade ${esgotado ? 'disponibilidade--esgotado' : 'disponibilidade--disponivel'}`}
        >
            {esgotado ? 'Esgotado' : `Em estoque (${qtd})`}
        </span>
    );
}
