// ---------------------------------------------------------------------------
// Tela: Detalhes do pedido (rota "/pedidos/:id")
//
// Busca o pedido completo (GET /api/pedidos/:id) e exibe o snapshot imutável:
// itens (nome, quantidade, preço unitário, subtotal de linha e atributos),
// dados do comprador, subtotal/frete/total, status e data. Como o snapshot já
// contém o nome dos produtos, nenhuma consulta adicional ao catálogo é
// necessária. (Requisitos 6.4, 6.7, 7.7, 8.2)
//
// Estados de loading/sucesso/erro na busca; link de volta para "/pedidos".
// Valores monetários via formatarReais; datas legíveis; layout responsivo.
// (Requisitos 11.7, 11.8, 11.9)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { pedidos as apiPedidos } from '../services/api.js';
import { formatarReais } from '../utils/formato.js';
import { formatarDataHora, StatusBadge } from '../components/ui/StatusPedido.jsx';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Botao from '../components/ui/Botao.jsx';

export default function DetalhesPedido() {
    const { id } = useParams();

    const [pedido, setPedido] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');

    const carregar = useCallback(async () => {
        setCarregando(true);
        setErro('');
        try {
            const dados = await apiPedidos.obter(id);
            setPedido(dados);
        } catch (e) {
            setErro(e.message || 'Não foi possível carregar o pedido.');
        } finally {
            setCarregando(false);
        }
    }, [id]);

    useEffect(() => {
        carregar();
    }, [carregar]);

    if (carregando) {
        return <Loading texto="Carregando pedido..." />;
    }

    if (erro) {
        return (
            <section className="pedido-detalhe">
                <div className="pagina-cabecalho">
                    <h1>Detalhes do pedido</h1>
                </div>
                <Mensagem tipo="erro">{erro}</Mensagem>
                <div className="pedido-detalhe__acoes-erro">
                    <Botao variante="secundario" onClick={carregar}>
                        Tentar novamente
                    </Botao>
                    <Link className="link-botao link-botao--secundario" to="/pedidos">
                        Voltar aos pedidos
                    </Link>
                </div>
            </section>
        );
    }

    if (!pedido) {
        return (
            <section className="pedido-detalhe">
                <div className="pagina-cabecalho">
                    <h1>Detalhes do pedido</h1>
                </div>
                <Mensagem tipo="info">
                    Pedido não encontrado.{' '}
                    <Link to="/pedidos">Voltar aos pedidos</Link>.
                </Mensagem>
            </section>
        );
    }

    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
    const comprador = pedido.comprador || {};
    const subtotal = Number(pedido.subtotal) || 0;
    const frete = Number(pedido.frete) || 0;
    const total = Number(pedido.total) || 0;

    return (
        <section className="pedido-detalhe">
            <div className="pagina-cabecalho">
                <h1>Pedido {pedido.id}</h1>
                <Link className="link-botao link-botao--secundario" to="/pedidos">
                    Voltar aos pedidos
                </Link>
            </div>

            <div className="pedido-detalhe__resumo-topo">
                <StatusBadge status={pedido.status} />
                <span className="pedido-detalhe__data">
                    {formatarDataHora(pedido.data)}
                </span>
            </div>

            <div className="pedido-detalhe__grade">
                {/* Itens (snapshot imutável) */}
                <div className="pedido-detalhe__itens">
                    <h2 className="pedido-detalhe__secao-titulo">Itens</h2>
                    <ul className="pedido-itens">
                        {itens.map((item) => {
                            const precoUnitario = Number(item.precoUnitario) || 0;
                            const quantidade = Number(item.quantidade) || 0;
                            const subtotalLinha = precoUnitario * quantidade;
                            const atributos =
                                item.atributos && typeof item.atributos === 'object'
                                    ? Object.entries(item.atributos)
                                    : [];
                            return (
                                <li
                                    className="pedido-item"
                                    key={item.produtoId}
                                >
                                    <div className="pedido-item__info">
                                        <span className="pedido-item__nome">
                                            {item.nome ||
                                                `Produto ${item.produtoId}`}
                                        </span>
                                        {atributos.length > 0 && (
                                            <ul className="pedido-item__atributos">
                                                {atributos.map(
                                                    ([chave, valor]) => (
                                                        <li key={chave}>
                                                            <span className="pedido-item__atributo-chave">
                                                                {chave}:
                                                            </span>{' '}
                                                            {String(valor)}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                    <span className="pedido-item__qtd">
                                        {quantidade} ×{' '}
                                        {formatarReais(precoUnitario)}
                                    </span>
                                    <strong className="pedido-item__total">
                                        {formatarReais(subtotalLinha)}
                                    </strong>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Comprador + totais */}
                <aside className="pedido-detalhe__lateral">
                    <div className="card">
                        <h2 className="pedido-detalhe__secao-titulo">
                            Dados de entrega
                        </h2>
                        <dl className="pedido-detalhe__comprador">
                            <div className="pedido-detalhe__comprador-linha">
                                <dt>Nome</dt>
                                <dd>{comprador.nome || '—'}</dd>
                            </div>
                            <div className="pedido-detalhe__comprador-linha">
                                <dt>CEP</dt>
                                <dd>{comprador.cep || '—'}</dd>
                            </div>
                            <div className="pedido-detalhe__comprador-linha">
                                <dt>Endereço</dt>
                                <dd>
                                    {comprador.endereco || '—'}
                                    {comprador.numero
                                        ? `, ${comprador.numero}`
                                        : ''}
                                </dd>
                            </div>
                            {comprador.complemento && (
                                <div className="pedido-detalhe__comprador-linha">
                                    <dt>Complemento</dt>
                                    <dd>{comprador.complemento}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div className="card">
                        <h2 className="pedido-detalhe__secao-titulo">Totais</h2>
                        <dl className="carrinho__totais">
                            <div className="carrinho__totais-linha">
                                <dt>Subtotal</dt>
                                <dd>{formatarReais(subtotal)}</dd>
                            </div>
                            <div className="carrinho__totais-linha">
                                <dt>Frete</dt>
                                <dd>
                                    {frete === 0
                                        ? 'Grátis'
                                        : formatarReais(frete)}
                                </dd>
                            </div>
                            <div className="carrinho__totais-linha carrinho__totais-linha--total">
                                <dt>Total</dt>
                                <dd>{formatarReais(total)}</dd>
                            </div>
                        </dl>
                    </div>
                </aside>
            </div>
        </section>
    );
}
