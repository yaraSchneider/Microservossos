// ---------------------------------------------------------------------------
// Testes do componente Mensagem (sucesso / erro / info).
// (Requisito 11.8 — mensagem final de sucesso ou erro)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Mensagem from './Mensagem.jsx';

describe('Mensagem', () => {
    it('renderiza o conteúdo informado', () => {
        render(<Mensagem tipo="info">Operação registrada</Mensagem>);
        expect(screen.getByText('Operação registrada')).toBeInTheDocument();
    });

    it('usa role="alert" para o tipo erro', () => {
        render(<Mensagem tipo="erro">Falha ao salvar</Mensagem>);
        const alerta = screen.getByRole('alert');
        expect(alerta).toHaveTextContent('Falha ao salvar');
    });

    it('usa role="status" para o tipo sucesso', () => {
        render(<Mensagem tipo="sucesso">Tudo certo</Mensagem>);
        expect(screen.getByRole('status')).toHaveTextContent('Tudo certo');
    });

    it('não renderiza nada quando não há conteúdo', () => {
        const { container } = render(<Mensagem tipo="info">{null}</Mensagem>);
        expect(container).toBeEmptyDOMElement();
    });

    it('exibe botão de fechar e dispara o callback', async () => {
        const aoFechar = vi.fn();
        render(
            <Mensagem tipo="info" onFechar={aoFechar}>
                Com botão
            </Mensagem>
        );
        await userEvent.click(screen.getByRole('button', { name: /fechar mensagem/i }));
        expect(aoFechar).toHaveBeenCalledTimes(1);
    });
});
