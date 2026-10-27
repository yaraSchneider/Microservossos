// ---------------------------------------------------------------------------
// App (shell de navegação + rotas) — Garimpo, brechó online
//
// Casca da aplicação: faixa de avisos, cabeçalho com a marca, navegação e o
// contador da sacola, e um <Routes> como outlet.
//
// Rotas:
//   /                      -> Vitrine (catálogo público)
//   /acervo                -> Acervo (gestão das peças: CRUD)
//   /produtos/novo         -> Cadastro de peça
//   /produtos/:id/editar   -> Edição de peça
//   /produto/:id           -> Detalhes da peça
//   /carrinho              -> Sacola
//   /checkout              -> Checkout
//   /pedidos               -> Pedidos (lista)
//   /pedidos/:id           -> Detalhes do pedido
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import Catalogo from './pages/Catalogo.jsx';
import Acervo from './pages/Acervo.jsx';
import DetalhesProduto from './pages/DetalhesProduto.jsx';
import CadastroProduto from './pages/CadastroProduto.jsx';
import Carrinho from './pages/Carrinho.jsx';
import Checkout from './pages/Checkout.jsx';
import Pedidos from './pages/Pedidos.jsx';
import DetalhesPedido from './pages/DetalhesPedido.jsx';
import EmBreve from './pages/EmBreve.jsx';
import Logo from './components/marca/Logo.jsx';
import Icone from './components/ui/Icone.jsx';
import { carrinho as apiCarrinho } from './services/api.js';
import { getCarrinhoId } from './utils/carrinhoId.js';
import { aoAtualizarSacola } from './utils/sacolaEventos.js';
import { formatarReais } from './utils/formato.js';
import { LIMITE_FRETE_GRATIS } from './utils/peca.js';

function LinkNav({ to, children, end = false }) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                isActive ? 'app-nav__link app-nav__link--ativo' : 'app-nav__link'
            }
        >
            {children}
        </NavLink>
    );
}

/** Quantidade de peças na sacola, atualizada a cada aviso de alteração. */
function useQuantidadeSacola() {
    const [quantidade, setQuantidade] = useState(0);

    useEffect(() => {
        let ativo = true;

        async function atualizar() {
            const id = getCarrinhoId();
            if (!id) {
                setQuantidade(0);
                return;
            }
            try {
                const dados = await apiCarrinho.obter(id);
                const itens = Array.isArray(dados?.itens) ? dados.itens : [];
                const total = itens.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0);
                if (ativo) setQuantidade(total);
            } catch {
                if (ativo) setQuantidade(0);
            }
        }

        atualizar();
        const cancelar = aoAtualizarSacola(atualizar);
        return () => {
            ativo = false;
            cancelar();
        };
    }, []);

    return quantidade;
}

export default function App() {
    const quantidadeSacola = useQuantidadeSacola();
    const { pathname } = useLocation();

    // Cada troca de tela começa do topo.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return (
        <div className="app">
            <div className="faixa-avisos">
                <div className="container faixa-avisos__inner">
                    <span>
                        <Icone nome="caminhao" tamanho={16} /> Frete grátis acima de{' '}
                        {formatarReais(LIMITE_FRETE_GRATIS)}
                    </span>
                    <span className="faixa-avisos__extra">
                        <Icone nome="folha" tamanho={16} /> Moda circular: cada peça é única
                    </span>
                </div>
            </div>

            <header className="app-header">
                <div className="container app-header__inner">
                    <Link to="/" className="app-brand" aria-label="Garimpo brechó — início">
                        <Logo />
                    </Link>

                    <nav className="app-nav" aria-label="Navegação principal">
                        <LinkNav to="/" end>
                            Vitrine
                        </LinkNav>
                        <LinkNav to="/acervo">Acervo</LinkNav>
                        <LinkNav to="/pedidos">Pedidos</LinkNav>
                    </nav>

                    <NavLink
                        to="/carrinho"
                        className={({ isActive }) =>
                            `botao-sacola ${isActive ? 'botao-sacola--ativo' : ''}`.trim()
                        }
                        aria-label={`Sacola, ${quantidadeSacola} ${quantidadeSacola === 1 ? 'peça' : 'peças'}`}
                    >
                        <Icone nome="sacola" tamanho={22} />
                        <span className="botao-sacola__rotulo">Sacola</span>
                        {quantidadeSacola > 0 && (
                            <span className="botao-sacola__contador">{quantidadeSacola}</span>
                        )}
                    </NavLink>
                </div>
            </header>

            <main className="container app-main">
                <Routes>
                    <Route path="/" element={<Catalogo />} />
                    <Route path="/acervo" element={<Acervo />} />
                    <Route path="/produto/:id" element={<DetalhesProduto />} />
                    <Route path="/produtos/novo" element={<CadastroProduto />} />
                    <Route path="/produtos/:id/editar" element={<CadastroProduto />} />
                    <Route path="/carrinho" element={<Carrinho />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/pedidos" element={<Pedidos />} />
                    <Route path="/pedidos/:id" element={<DetalhesPedido />} />
                    <Route path="*" element={<EmBreve titulo="Página não encontrada" />} />
                </Routes>
            </main>

            <footer className="app-footer">
                <div className="container app-footer__inner">
                    <div className="app-footer__marca">
                        <Logo claro />
                        <p>
                            Roupas com história, garimpadas uma a uma. Comprar de segunda mão é
                            dar mais uma volta ao que já existe.
                        </p>
                    </div>
                    <div className="app-footer__colunas">
                        <div>
                            <h2>Loja</h2>
                            <Link to="/">Vitrine</Link>
                            <Link to="/carrinho">Sacola</Link>
                            <Link to="/pedidos">Meus pedidos</Link>
                        </div>
                        <div>
                            <h2>Bastidores</h2>
                            <Link to="/acervo">Acervo</Link>
                            <Link to="/produtos/novo">Cadastrar peça</Link>
                        </div>
                    </div>
                </div>
                <div className="container app-footer__base">
                    Garimpo brechó · e-commerce em microsserviços (Produtos, Carrinho e Pedidos)
                </div>
            </footer>
        </div>
    );
}
