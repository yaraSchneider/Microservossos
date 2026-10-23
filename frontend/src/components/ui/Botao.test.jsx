// ---------------------------------------------------------------------------
// Testes do componente Botao (estado de carregamento/desabilitado).
// (Requisito 11.8 — estado de carregamento em operações de backend)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Botao from './Botao.jsx';

describe('Botao', () => {
    it('renderiza o rótulo informado', () => {
        render(<Botao>Adicionar ao carrinho</Botao>);
        expect(
            screen.getByRole('button', { name: /adicionar ao carrinho/i })
        ).toBeInTheDocument();
    });

    it('fica desabilitado e sinaliza aria-busy quando carregando', () => {
        render(<Botao carregando>Salvar</Botao>);
        const botao = screen.getByRole('button', { name: /salvar/i });
        expect(botao).toBeDisabled();
        expect(botao).toHaveAttribute('aria-busy', 'true');
    });

    it('não fica ocupado quando não está carregando', () => {
        render(<Botao>Salvar</Botao>);
        const botao = screen.getByRole('button', { name: /salvar/i });
        expect(botao).toBeEnabled();
        expect(botao).toHaveAttribute('aria-busy', 'false');
    });

    it('respeita a prop disabled', () => {
        render(<Botao disabled>Esgotado</Botao>);
        expect(screen.getByRole('button', { name: /esgotado/i })).toBeDisabled();
    });
});
