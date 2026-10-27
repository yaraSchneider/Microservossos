// ---------------------------------------------------------------------------
// Tela: Pedidos (rota "/pedidos")
//
// Lista o histórico de pedidos (GET /api/pedidos), exibindo para cada um o
// identificador, a data de compra formatada em pt-BR, o total em reais e o
// status com um selo visual (badge). Cada pedido oferece a ação "Ver detalhes"
// que leva à rota "/pedidos/:id".
//
// Estados de loading/sucesso/erro em toda operação dependente de backend e um
// estado vazio amigável ("Nenhum pedido ainda"). Valores monetários via
// formatarReais; layout responsivo. (Requisitos 8.1, 11.7, 11.8, 11.9)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { pedidos as apiPedidos } from '../services/api.js';
import { formatarReais } from '../utils/formato.js';
import { formatarDataHora, StatusBadge } from '../components/ui/StatusPedido.jsx';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Botao from '../components/ui/Botao.jsx';
import Icone from '../components/ui/Icone.jsx';

export default function Pedidos() {
    const [lista, setLista] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');

    const carregar = useCallback(async () => {
        setCarregando(true);
        setErro('');
        try {
            const dados = await apiPedidos.listar();
            setLista(Array.isArray(dados) ? dados : []);
        } catch (e) {
            setErro(e.message || 'Não foi possível carregar os pedidos.');
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    if (carregando) {
        return <Loading texto="Carregando pedidos..." />;
    }

    if (erro) {
        return (
            <section className="pedidos">
                <div className="pagina-cabecalho">
                    <h1>Pedidos</h1>
                </div>
                <Mensagem tipo="erro">{erro}</Mensagem>
                <div className="pedidos__acoes-erro">
                    <Botao variante="secundario" onClick={carregar}>
                        Tentar novamente
                    </Botao>
                    <Link className="link-botao link-botao--secundario" to="/">
                        Voltar à vitrine
                    </Link>
                </div>
            </section>
        );
    }

    if (lista.length === 0) {
        return (
            <section className="pedidos pedidos--vazio">
                <div className="estado-vazio">
                    <span className="estado-vazio__icone">
                        <Icone nome="caixa" tamanho={40} />
                    </span>
                    <h1>Nenhum pedido ainda</h1>
                    <p>Quando você garimpar sua primeira peça, o pedido aparece aqui.</p>
                    <Link className="link-botao" to="/">
                        Explorar a vitrine
                    </Link>
                </div>
            </section>
        );
    }

    // Mais recentes primeiro.
    const ordenados = [...lista].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const pagos = lista.filter((p) => p.status === 'PAGO');
    const totalPago = pagos.reduce((soma, p) => soma + (Number(p.total) || 0), 0);

    return (
        <section className="pedidos">
            <div className="pagina-cabecalho">
                <div>
                    <p className="sobretitulo">
                        {pagos.length} {pagos.length === 1 ? 'pedido pago' : 'pedidos pagos'} ·{' '}
                        {formatarReais(totalPago)}
                    </p>
                    <h1>Pedidos</h1>
                </div>
                <Link className="link-botao link-botao--secundario" to="/">
                    Continuar garimpando
                </Link>
            </div>

            <ul className="pedidos__lista">
                {ordenados.map((pedido) => (
                    <li className="pedido-card" key={pedido.id}>
                        <Link
                            className="pedido-card__link"
                            to={`/pedidos/${encodeURIComponent(pedido.id)}`}
                        >
                            <span className="pedido-card__icone" aria-hidden="true">
                                <Icone nome="caixa" tamanho={22} />
                            </span>
                            <span className="pedido-card__id">
                                <span className="pedido-card__rotulo">Pedido</span>
                                <strong>{pedido.id}</strong>
                            </span>
                            <span className="pedido-card__data">
                                {formatarDataHora(pedido.data)}
                            </span>
                            <StatusBadge status={pedido.status} />
                            <strong className="pedido-card__total">
                                {formatarReais(pedido.total)}
                            </strong>
                            <span className="pedido-card__seta" aria-hidden="true">
                                <Icone nome="seguir" tamanho={18} />
                            </span>
                            <span className="sr-only">Ver detalhes</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
