// ---------------------------------------------------------------------------
// Teste de tela: Catálogo — estados de carregamento, sucesso e erro.
//
// Cobre o fluxo de uma operação dependente de backend: exibe loading,
// depois a lista de produtos com preços formatados em reais (sucesso) ou
// uma mensagem amigável (erro). A camada de API é mockada para não depender
// do servidor de dev nem dos backends. (Requisitos 11.1, 11.8, 11.9)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock da camada de API. Cada teste define o comportamento de `listar`.
vi.mock('../services/api.js', () => ({
    produtos: { listar: vi.fn() },
    carrinho: { adicionarItem: vi.fn() },
}));

// Evita tocar no localStorage/rede ao renderizar os cards.
vi.mock('../utils/carrinhoId.js', () => ({
    obterOuCriarCarrinhoId: vi.fn().mockResolvedValue('c-teste'),
}));

import Catalogo from './Catalogo.jsx';
import { produtos as apiProdutos } from '../services/api.js';

function renderizar() {
    return render(
        <MemoryRouter>
            <Catalogo />
        </MemoryRouter>
    );
}

describe('Tela Catálogo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exibe o estado de carregamento enquanto busca os produtos', () => {
        // Promessa pendente -> permanece em loading.
        apiProdutos.listar.mockReturnValue(new Promise(() => {}));
        renderizar();
        expect(screen.getByText(/carregando produtos/i)).toBeInTheDocument();
    });

    it('exibe os produtos com preços em reais no sucesso', async () => {
        apiProdutos.listar.mockResolvedValue([
            { id: 'p-1', nome: 'Caneca', preco: 350000, categoria: 'Cozinha', estoque: 5 },
            { id: 'p-2', nome: 'Caderno', preco: 1, categoria: 'Papelaria', estoque: 0 },
        ]);

        renderizar();
        await waitForElementToBeRemoved(() => screen.queryByText(/carregando produtos/i));

        expect(screen.getByText('Caneca')).toBeInTheDocument();
        expect(screen.getByText('Caderno')).toBeInTheDocument();
        // Preços formatados em reais (normaliza o espaço não separável).
        const normalizar = (t) => t.replace(/\u00a0/g, ' ');
        expect(
            screen.getByText((c) => normalizar(c) === 'R$ 3.500,00')
        ).toBeInTheDocument();
        expect(
            screen.getByText((c) => normalizar(c) === 'R$ 0,01')
        ).toBeInTheDocument();
    });

    it('exibe uma mensagem de erro amigável quando a busca falha', async () => {
        apiProdutos.listar.mockRejectedValue(
            new Error('Não foi possível conectar ao servidor. Tente novamente.')
        );

        renderizar();
        await waitForElementToBeRemoved(() => screen.queryByText(/carregando produtos/i));

        const alerta = screen.getByRole('alert');
        expect(alerta).toHaveTextContent(/não foi possível conectar ao servidor/i);
    });

    it('exibe estado vazio quando não há produtos', async () => {
        apiProdutos.listar.mockResolvedValue([]);

        renderizar();
        await waitForElementToBeRemoved(() => screen.queryByText(/carregando produtos/i));

        expect(screen.getByText(/nenhum produto cadastrado ainda/i)).toBeInTheDocument();
    });
});
