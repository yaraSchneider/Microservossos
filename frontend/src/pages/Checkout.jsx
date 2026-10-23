// ---------------------------------------------------------------------------
// Tela: Checkout (rota "/checkout")
//
// Exibe o resumo final do pedido (itens com quantidade e subtotal de linha,
// subtotal, frete e total) e um formulário com os dados do comprador (nome,
// CEP, endereço, número e complemento opcional). Oferece o pagamento simulado
// com dois botões: "Simular pagamento aprovado" e "Simular pagamento recusado".
//
// Fluxo do pagamento (Requisitos 6, 7.6):
//  1. Ao acionar um botão de pagamento, se ainda não houver um pedido criado
//     nesta sessão de checkout, cria-se o pedido (POST /pedidos) — que valida e
//     reserva o estoque e retorna um pedido PENDENTE com id.
//  2. Em seguida, processa-se o pagamento (POST /pedidos/:id/pagamento) com
//     `aprovado` conforme o botão acionado.
//  3. aprovado=true (PAGO): mensagem de sucesso; o carrinho é limpo no backend,
//     então limpamos o carrinhoId local (resetCarrinhoId) para iniciar um novo
//     carrinho; links para "Ver pedidos" e catálogo.
//  4. aprovado=false (PAGAMENTO_RECUSADO): mensagem de recusa (estoque devolvido)
//     e opção de tentar novamente. Como o backend permite uma nova finalização
//     após a recusa, esquecemos o id do pedido para que uma nova tentativa crie
//     um pedido novo.
//
// Estados de loading/sucesso/erro; valores monetários via formatarReais;
// layout responsivo. (Requisitos 11.6, 11.8, 11.9, 7.6)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    produtos as apiProdutos,
    carrinho as apiCarrinho,
    pedidos as apiPedidos,
} from '../services/api.js';
import { getCarrinhoId, resetCarrinhoId } from '../utils/carrinhoId.js';
import { formatarReais } from '../utils/formato.js';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Botao from '../components/ui/Botao.jsx';

export default function Checkout() {
    const [carrinhoId] = useState(() => getCarrinhoId());
    const [carrinhoDados, setCarrinhoDados] = useState(null);
    // Mapa produtoId -> produto (nome) para exibição dos itens no resumo.
    const [produtosMap, setProdutosMap] = useState({});

    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');

    // Dados do comprador (comprador). complemento é opcional.
    const [comprador, setComprador] = useState({
        nome: '',
        cep: '',
        endereco: '',
        numero: '',
        complemento: '',
    });
    const [erroValidacao, setErroValidacao] = useState('');

    // Pagamento: id do pedido criado nesta sessão de checkout (para não
    // duplicar), estado de processamento e feedback de erro da operação.
    const [pedidoId, setPedidoId] = useState(null);
    const [processando, setProcessando] = useState(null); // 'aprovado' | 'recusado' | null
    const [erroPagamento, setErroPagamento] = useState('');

    // Resultado final do pagamento (pedido PAGO ou PAGAMENTO_RECUSADO).
    const [resultado, setResultado] = useState(null); // { pedido, aprovado }

    /**
     * Busca o carrinho para montar o resumo. 404 (id obsoleto) é tratado como
     * carrinho vazio. Também carrega os produtos para mapear nomes por item.
     */
    const carregarCarrinho = useCallback(async () => {
        if (!carrinhoId) {
            setCarrinhoDados(null);
            setCarregando(false);
            return;
        }

        setCarregando(true);
        setErro('');

        try {
            const dados = await apiCarrinho.obter(carrinhoId);
            setCarrinhoDados(dados);
            // Pré-preenche o CEP do comprador a partir do carrinho, se houver.
            if (dados?.cep) {
                setComprador((atual) =>
                    atual.cep ? atual : { ...atual, cep: dados.cep }
                );
            }

            const itens = Array.isArray(dados?.itens) ? dados.itens : [];
            if (itens.length > 0) {
                try {
                    const lista = await apiProdutos.listar();
                    const mapa = {};
                    if (Array.isArray(lista)) {
                        for (const p of lista) {
                            mapa[p.id] = p;
                        }
                    }
                    setProdutosMap(mapa);
                } catch {
                    // Falha ao obter nomes não impede o checkout.
                    setProdutosMap({});
                }
            }
        } catch (e) {
            const msg = e.message || '';
            if (/404|não encontrado|nao encontrado/i.test(msg)) {
                setCarrinhoDados(null);
            } else {
                setErro(msg || 'Não foi possível carregar o resumo do pedido.');
            }
        } finally {
            setCarregando(false);
        }
    }, [carrinhoId]);

    useEffect(() => {
        carregarCarrinho();
    }, [carregarCarrinho]);

    function atualizarCampo(campo, valor) {
        setComprador((atual) => ({ ...atual, [campo]: valor }));
    }

    /** Validação mínima no cliente: campos obrigatórios. O backend revalida. */
    function validarComprador() {
        if (!comprador.nome.trim()) {
            return 'Informe o nome do comprador.';
        }
        if (!comprador.cep.trim()) {
            return 'Informe o CEP.';
        }
        if (!comprador.endereco.trim()) {
            return 'Informe o endereço.';
        }
        if (!comprador.numero.trim()) {
            return 'Informe o número.';
        }
        return '';
    }

    /**
     * Sequência create+pay. Cria o pedido (se ainda não criado nesta sessão) e
     * processa o pagamento com `aprovado`. Trata erros com mensagens amigáveis.
     */
    async function processarPagamento(aprovado) {
        setErroPagamento('');
        setResultado(null);

        const erroCampos = validarComprador();
        if (erroCampos) {
            setErroValidacao(erroCampos);
            return;
        }
        setErroValidacao('');

        setProcessando(aprovado ? 'aprovado' : 'recusado');
        try {
            // 1. Cria o pedido se ainda não houver um id desta sessão. O
            //    backend é idempotente por carrinho, mas lembrar o id evita
            //    chamadas desnecessárias.
            let idAtual = pedidoId;
            if (!idAtual) {
                const pedido = await apiPedidos.criar({
                    carrinhoId,
                    comprador: {
                        nome: comprador.nome.trim(),
                        cep: comprador.cep.trim(),
                        endereco: comprador.endereco.trim(),
                        numero: comprador.numero.trim(),
                        complemento: comprador.complemento.trim(),
                    },
                });
                idAtual = pedido?.id;
                if (!idAtual) {
                    throw new Error('Não foi possível criar o pedido.');
                }
                setPedidoId(idAtual);
            }

            // 2. Processa o pagamento simulado.
            const pedidoPago = await apiPedidos.pagar(idAtual, { aprovado });
            setResultado({ pedido: pedidoPago, aprovado });

            if (aprovado) {
                // 3. Carrinho limpo no backend -> inicia um novo carrinho local.
                resetCarrinhoId();
            } else {
                // 4. Recusa: estoque devolvido; permite nova tentativa com um
                //    pedido novo (o backend libera a finalização após recusa).
                setPedidoId(null);
            }
        } catch (e) {
            // Em caso de falha após criar o pedido, descarta o id para que uma
            // nova tentativa recrie o pedido de forma consistente.
            setPedidoId(null);
            setErroPagamento(
                e.message || 'Não foi possível processar o pagamento. Tente novamente.'
            );
        } finally {
            setProcessando(null);
        }
    }

    if (carregando) {
        return <Loading texto="Carregando resumo do pedido..." />;
    }

    if (erro) {
        return (
            <div>
                <Mensagem tipo="erro">{erro}</Mensagem>
                <p>
                    <Link to="/carrinho">← Voltar ao carrinho</Link>
                </p>
            </div>
        );
    }

    // Resultado do pagamento (sucesso/recusa) substitui a tela de checkout.
    if (resultado && resultado.aprovado) {
        const pedido = resultado.pedido || {};
        return (
            <section className="card checkout__resultado">
                <h1>Pagamento aprovado!</h1>
                <Mensagem tipo="sucesso">
                    Pagamento aprovado! Pedido {pedido.id} confirmado.
                </Mensagem>
                <p>
                    Obrigado pela compra. Você pode acompanhar o andamento na tela
                    de pedidos.
                </p>
                <div className="checkout__resultado-acoes">
                    <Link className="link-botao" to="/pedidos">
                        Ver pedidos
                    </Link>
                    <Link className="link-botao link-botao--secundario" to="/">
                        Voltar ao catálogo
                    </Link>
                </div>
            </section>
        );
    }

    const itens = Array.isArray(carrinhoDados?.itens) ? carrinhoDados.itens : [];
    const vazio = !carrinhoDados || itens.length === 0;

    // Sem carrinho / carrinho vazio: não há o que finalizar.
    if (vazio) {
        return (
            <section className="checkout checkout--vazio">
                <div className="pagina-cabecalho">
                    <h1>Checkout</h1>
                </div>
                <Mensagem tipo="info">
                    Seu carrinho está vazio, não há pedido para finalizar.{' '}
                    <Link to="/">Explorar o catálogo</Link> ou{' '}
                    <Link to="/carrinho">ver o carrinho</Link>.
                </Mensagem>
            </section>
        );
    }

    const subtotal = Number(carrinhoDados.subtotal) || 0;
    const frete = Number(carrinhoDados.frete) || 0;
    const total = Number(carrinhoDados.total) || 0;
    const freteCalculado = Boolean(carrinhoDados.cep);
    const ocupado = processando !== null;

    return (
        <section className="checkout">
            <div className="pagina-cabecalho">
                <h1>Checkout</h1>
                <Link className="link-botao link-botao--secundario" to="/carrinho">
                    Voltar ao carrinho
                </Link>
            </div>

            <div className="carrinho__grade">
                {/* Formulário de dados do comprador + pagamento simulado */}
                <form
                    className="checkout__form"
                    onSubmit={(e) => e.preventDefault()}
                    noValidate
                >
                    <h2 className="checkout__secao-titulo">Dados de entrega</h2>

                    <div className="form__grupo">
                        <label className="form__label" htmlFor="nome">
                            Nome <span aria-hidden="true">*</span>
                        </label>
                        <input
                            id="nome"
                            className="form__controle"
                            type="text"
                            value={comprador.nome}
                            onChange={(e) => atualizarCampo('nome', e.target.value)}
                            disabled={ocupado}
                            required
                        />
                    </div>

                    <div className="form__linha">
                        <div className="form__grupo">
                            <label className="form__label" htmlFor="cep">
                                CEP <span aria-hidden="true">*</span>
                            </label>
                            <input
                                id="cep"
                                className="form__controle"
                                type="text"
                                inputMode="numeric"
                                placeholder="00000-000"
                                value={comprador.cep}
                                onChange={(e) => atualizarCampo('cep', e.target.value)}
                                disabled={ocupado}
                                required
                            />
                        </div>
                        <div className="form__grupo">
                            <label className="form__label" htmlFor="numero">
                                Número <span aria-hidden="true">*</span>
                            </label>
                            <input
                                id="numero"
                                className="form__controle"
                                type="text"
                                value={comprador.numero}
                                onChange={(e) =>
                                    atualizarCampo('numero', e.target.value)
                                }
                                disabled={ocupado}
                                required
                            />
                        </div>
                    </div>

                    <div className="form__grupo">
                        <label className="form__label" htmlFor="endereco">
                            Endereço <span aria-hidden="true">*</span>
                        </label>
                        <input
                            id="endereco"
                            className="form__controle"
                            type="text"
                            value={comprador.endereco}
                            onChange={(e) =>
                                atualizarCampo('endereco', e.target.value)
                            }
                            disabled={ocupado}
                            required
                        />
                    </div>

                    <div className="form__grupo">
                        <label className="form__label" htmlFor="complemento">
                            Complemento
                        </label>
                        <input
                            id="complemento"
                            className="form__controle"
                            type="text"
                            placeholder="Opcional"
                            value={comprador.complemento}
                            onChange={(e) =>
                                atualizarCampo('complemento', e.target.value)
                            }
                            disabled={ocupado}
                        />
                    </div>

                    {erroValidacao && (
                        <Mensagem
                            tipo="erro"
                            onFechar={() => setErroValidacao('')}
                        >
                            {erroValidacao}
                        </Mensagem>
                    )}

                    {erroPagamento && (
                        <Mensagem tipo="erro" onFechar={() => setErroPagamento('')}>
                            {erroPagamento}
                        </Mensagem>
                    )}

                    {resultado && !resultado.aprovado && (
                        <Mensagem tipo="erro">
                            Pagamento recusado. O estoque reservado foi devolvido.
                            Revise os dados e tente novamente.
                        </Mensagem>
                    )}

                    <h2 className="checkout__secao-titulo">Pagamento simulado</h2>
                    <p className="form__ajuda">
                        Escolha o resultado do pagamento para concluir a compra.
                    </p>
                    <div className="checkout__pagamento-acoes">
                        <Botao
                            type="button"
                            variante="primario"
                            onClick={() => processarPagamento(true)}
                            carregando={processando === 'aprovado'}
                            disabled={ocupado}
                        >
                            Simular pagamento aprovado
                        </Botao>
                        <Botao
                            type="button"
                            variante="perigo"
                            onClick={() => processarPagamento(false)}
                            carregando={processando === 'recusado'}
                            disabled={ocupado}
                        >
                            Simular pagamento recusado
                        </Botao>
                    </div>
                </form>

                {/* Resumo final do pedido */}
                <aside className="carrinho__resumo">
                    <h2 className="carrinho__resumo-titulo">Resumo do pedido</h2>

                    <ul className="checkout__itens">
                        {itens.map((item) => {
                            const produto = produtosMap[item.produtoId];
                            const nome =
                                produto?.nome || `Produto ${item.produtoId}`;
                            const precoUnitario = Number(item.precoUnitario) || 0;
                            const quantidade = Number(item.quantidade) || 0;
                            const subtotalLinha = precoUnitario * quantidade;
                            return (
                                <li
                                    className="checkout__item"
                                    key={item.produtoId}
                                >
                                    <span className="checkout__item-nome">
                                        {nome}
                                    </span>
                                    <span className="checkout__item-qtd">
                                        {quantidade} ×{' '}
                                        {formatarReais(precoUnitario)}
                                    </span>
                                    <strong className="checkout__item-total">
                                        {formatarReais(subtotalLinha)}
                                    </strong>
                                </li>
                            );
                        })}
                    </ul>

                    <dl className="carrinho__totais">
                        <div className="carrinho__totais-linha">
                            <dt>Subtotal</dt>
                            <dd>{formatarReais(subtotal)}</dd>
                        </div>
                        <div className="carrinho__totais-linha">
                            <dt>Frete</dt>
                            <dd>
                                {freteCalculado
                                    ? frete === 0
                                        ? 'Grátis'
                                        : formatarReais(frete)
                                    : '—'}
                            </dd>
                        </div>
                        <div className="carrinho__totais-linha carrinho__totais-linha--total">
                            <dt>Total</dt>
                            <dd>{formatarReais(total)}</dd>
                        </div>
                    </dl>
                </aside>
            </div>
        </section>
    );
}
