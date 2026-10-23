// ---------------------------------------------------------------------------
// Testes do StatusPedido (StatusBadge + formatarDataHora).
// (Requisitos 7.5, 8.1, 11.7)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge, formatarDataHora } from './StatusPedido.jsx';

describe('StatusBadge', () => {
    it.each([
        ['PENDENTE', 'Pendente'],
        ['PAGO', 'Pago'],
        ['PAGAMENTO_RECUSADO', 'Pagamento recusado'],
        ['CANCELADO', 'Cancelado'],
    ])('exibe rótulo legível para o status %s', (status, rotulo) => {
        render(<StatusBadge status={status} />);
        expect(screen.getByText(rotulo)).toBeInTheDocument();
    });

    it('usa um rótulo de fallback para status desconhecido', () => {
        render(<StatusBadge status="OUTRO" />);
        expect(screen.getByText('OUTRO')).toBeInTheDocument();
    });
});

describe('formatarDataHora', () => {
    it('retorna "—" para data ausente', () => {
        expect(formatarDataHora('')).toBe('—');
        expect(formatarDataHora(undefined)).toBe('—');
    });

    it('retorna "—" para data inválida', () => {
        expect(formatarDataHora('não-é-data')).toBe('—');
    });

    it('formata uma data ISO válida em texto legível', () => {
        const resultado = formatarDataHora('2024-01-15T10:30:00.000Z');
        expect(resultado).not.toBe('—');
        expect(typeof resultado).toBe('string');
        expect(resultado.length).toBeGreaterThan(0);
    });
});
