// ---------------------------------------------------------------------------
// StatusPedido — selo (badge) de status do pedido + formatação de data
//
// Utilitários compartilhados pelas telas de Pedidos (lista e detalhes) para
// exibir o status com um selo visual consistente e datas legíveis em pt-BR.
//
// Status possíveis (Requisito 7.5): PENDENTE | PAGO | PAGAMENTO_RECUSADO |
// CANCELADO. (Requisitos 8.1, 11.7)
// ---------------------------------------------------------------------------

// Mapa de status -> { rotulo legível, modificador de classe CSS }.
const STATUS = {
    PENDENTE: { rotulo: 'Pendente', modificador: 'pendente' },
    PAGO: { rotulo: 'Pago', modificador: 'pago' },
    PAGAMENTO_RECUSADO: {
        rotulo: 'Pagamento recusado',
        modificador: 'recusado',
    },
    CANCELADO: { rotulo: 'Cancelado', modificador: 'cancelado' },
};

/**
 * Selo visual para o status de um pedido.
 *
 * @param {object} props
 * @param {string} props.status Status do pedido.
 */
export function StatusBadge({ status }) {
    const info = STATUS[status] || {
        rotulo: status || 'Desconhecido',
        modificador: 'desconhecido',
    };
    return (
        <span className={`status-badge status-badge--${info.modificador}`}>
            {info.rotulo}
        </span>
    );
}

/**
 * Formata uma data ISO em data/hora legível no padrão pt-BR.
 * Retorna '—' quando a data é ausente ou inválida.
 *
 * @param {string} iso Data em formato ISO 8601.
 * @returns {string}
 */
export function formatarDataHora(iso) {
    if (!iso) {
        return '—';
    }
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) {
        return '—';
    }
    return data.toLocaleString('pt-BR');
}

export default StatusBadge;
