// ---------------------------------------------------------------------------
// App (shell de navegação + rotas)
//
// Casca da aplicação: header/nav com <Link> e um <Routes> como outlet. As seis
// telas têm rotas definidas; as de tarefas futuras (9.4–9.6) usam o placeholder
// "Em breve" até serem implementadas.
//
// Rotas:
//   /                      -> Catálogo            (tarefa 9.2)
//   /produtos/novo         -> Cadastro de produto (tarefa 9.3)
//   /produtos/:id/editar   -> Edição de produto   (tarefa 9.3)
//   /produto/:id           -> Detalhes do produto (tarefa 9.2)
//   /carrinho              -> Carrinho            (tarefa 9.4)
//   /checkout              -> Checkout            (tarefa 9.5)
//   /pedidos               -> Pedidos (lista)     (tarefa 9.6)
//   /pedidos/:id           -> Detalhes do pedido  (tarefa 9.6)
// ---------------------------------------------------------------------------

import { NavLink, Route, Routes } from 'react-router-dom';
import Catalogo from './pages/Catalogo.jsx';
import DetalhesProduto from './pages/DetalhesProduto.jsx';
import CadastroProduto from './pages/CadastroProduto.jsx';
import Carrinho from './pages/Carrinho.jsx';
import Checkout from './pages/Checkout.jsx';
import Pedidos from './pages/Pedidos.jsx';
import DetalhesPedido from './pages/DetalhesPedido.jsx';
import EmBreve from './pages/EmBreve.jsx';

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

export default function App() {
    return (
        <div className="app">
            <header className="app-header">
                <div className="container app-header__inner">
                    <NavLink to="/" className="app-brand">
                        E-commerce
                    </NavLink>
                    <nav className="app-nav" aria-label="Navegação principal">
                        <LinkNav to="/" end>
                            Catálogo
                        </LinkNav>
                        <LinkNav to="/produtos/novo">Novo produto</LinkNav>
                        <LinkNav to="/carrinho">Carrinho</LinkNav>
                        <LinkNav to="/pedidos">Pedidos</LinkNav>
                    </nav>
                </div>
            </header>

            <main className="container app-main">
                <Routes>
                    <Route path="/" element={<Catalogo />} />
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
                <div className="container">E-commerce · Microsserviços</div>
            </footer>
        </div>
    );
}
