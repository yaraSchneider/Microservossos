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
                        Voltar ao catálogo
                    </Link>
                </div>
            </section>
        );
    }

    if (lista.length === 0) {
        return (
            <section className="pedidos pedidos--vazio">
                <div className="pagina-cabecalho">
                    <h1>Pedidos</h1>
                </div>
                <Mensagem tipo="info">
                    Nenhum pedido ainda. <Link to="/">Explorar o catálogo</Link>.
                </Mensagem>
            </section>
        );
    }

    return (
        <section className="pedidos">
            <div className="pagina-cabecalho">
                <h1>Pedidos</h1>
                <Link className="link-botao link-botao--secundario" to="/">
                    Continuar comprando
                </Link>
            </div>

            <ul className="pedidos__lista">
                {lista.map((pedido) => (
                    <li className="pedido-card" key={pedido.id}>
                        <div className="pedido-card__cabecalho">
                            <div className="pedido-card__id">
                                <span className="pedido-card__rotulo">Pedido</span>
                                <strong>{pedido.id}</strong>
                            </div>
                            <StatusBadge status={pedido.status} />
                        </div>

                        <dl className="pedido-card__dados">
                            <div className="pedido-card__linha">
                                <dt>Data</dt>
                                <dd>{formatarDataHora(pedido.data)}</dd>
                            </div>
                            <div className="pedido-card__linha">
                                <dt>Total</dt>
                                <dd className="pedido-card__total">
                                    {formatarReais(pedido.total)}
                                </dd>
                            </div>
                        </dl>

                        <div className="pedido-card__acoes">
                            <Link
                                className="link-botao"
                                to={`/pedidos/${encodeURIComponent(pedido.id)}`}
                            >
                                Ver detalhes
                            </Link>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
