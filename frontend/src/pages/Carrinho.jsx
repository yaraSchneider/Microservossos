// ---------------------------------------------------------------------------
// Tela: Carrinho (rota "/carrinho")
//
// Mostra os itens do carrinho (nome, imagem, preço unitário, quantidade e
// subtotal de linha), o Subtotal, um campo de CEP com a ação "Calcular frete",
// o valor do Frete, o Total e a ação "Finalizar compra". Permite remover itens
// e alterar quantidades, sempre re-buscando o carrinho após cada alteração para
// refletir os valores recalculados pelo backend (fonte da verdade).
//
// Estados de loading/sucesso/erro em todas as operações dependentes de backend;
// valores monetários via formatarReais; layout responsivo.
// (Requisitos 11.5, 11.8, 11.9)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { produtos as apiProdutos, carrinho as apiCarrinho } from '../services/api.js';
import { getCarrinhoId } from '../utils/carrinhoId.js';
import { formatarReais } from '../utils/formato.js';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Botao from '../components/ui/Botao.jsx';
import ImagemProduto from '../components/ui/ImagemProduto.jsx';

export default function Carrinho() {
    const navegar = useNavigate();

    const [carrinhoId] = useState(() => getCarrinhoId());
    const [carrinhoDados, setCarrinhoDados] = useState(null);
    // Mapa produtoId -> produto (nome/imagem) para exibição dos itens.
    const [produtosMap, setProdutosMap] = useState({});

    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    // Feedback global de mutações (banner de sucesso/erro).
    const [feedback, setFeedback] = useState(null); // { tipo, texto }

    // CEP / frete.
    const [cep, setCep] = useState('');
    const [calculandoFrete, setCalculandoFrete] = useState(false);

    /**
     * Busca o carrinho no backend. Trata 404 (id obsoleto) como carrinho vazio.
     * Também carrega os produtos (uma vez) para mapear nome/imagem por item.
     */
    const carregarCarrinho = useCallback(
        async ({ silencioso = false } = {}) => {
            if (!carrinhoId) {
                setCarrinhoDados(null);
                setCarregando(false);
                return;
            }

            if (!silencioso) {
                setCarregando(true);
            }
            setErro('');

            try {
                const dados = await apiCarrinho.obter(carrinhoId);
                setCarrinhoDados(dados);
                setCep(dados?.cep || '');

                // Carrega nomes/imagens dos produtos presentes no carrinho.
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
                        // Falha ao obter nomes não impede exibir o carrinho.
                        setProdutosMap({});
                    }
                }
            } catch (e) {
                // 404 (carrinho obsoleto/inexistente) -> tratar como vazio.
                const msg = e.message || '';
                if (/404|não encontrado|nao encontrado/i.test(msg)) {
                    setCarrinhoDados(null);
                } else {
                    setErro(msg || 'Não foi possível carregar o carrinho.');
                }
            } finally {
                setCarregando(false);
            }
        },
        [carrinhoId]
    );

    useEffect(() => {
        carregarCarrinho();
    }, [carregarCarrinho]);

    if (carregando) {
        return <Loading texto="Carregando carrinho..." />;
    }

    if (erro) {
        return (
            <div>
                <Mensagem tipo="erro">{erro}</Mensagem>
                <p>
                    <Link to="/">← Voltar ao catálogo</Link>
                </p>
            </div>
        );
    }

    const itens = Array.isArray(carrinhoDados?.itens) ? carrinhoDados.itens : [];
    const vazio = !carrinhoDados || itens.length === 0;

    if (vazio) {
        return (
            <section className="carrinho carrinho--vazio">
                <div className="pagina-cabecalho">
                    <h1>Carrinho</h1>
                </div>
                <Mensagem tipo="info">
                    Seu carrinho está vazio.{' '}
                    <Link to="/">Explorar o catálogo</Link>.
                </Mensagem>
            </section>
        );
    }

    const subtotal = Number(carrinhoDados.subtotal) || 0;
    const frete = Number(carrinhoDados.frete) || 0;
    const total = Number(carrinhoDados.total) || 0;
    const freteCalculado = Boolean(carrinhoDados.cep);

    async function alterarQuantidade(produtoId, novaQuantidade) {
        const quantidade = Math.max(1, Math.floor(Number(novaQuantidade) || 0));
        setFeedback(null);
        try {
            await apiCarrinho.alterarItem(carrinhoId, produtoId, { quantidade });
            await carregarCarrinho({ silencioso: true });
        } catch (e) {
            setFeedback({
                tipo: 'erro',
                texto: e.message || 'Não foi possível alterar a quantidade.',
            });
            // Re-sincroniza para refletir o estado real do backend.
            await carregarCarrinho({ silencioso: true });
        }
    }

    async function removerItem(produtoId, nome) {
        setFeedback(null);
        try {
            await apiCarrinho.removerItem(carrinhoId, produtoId);
            await carregarCarrinho({ silencioso: true });
            setFeedback({
                tipo: 'sucesso',
                texto: `"${nome}" removido do carrinho.`,
            });
        } catch (e) {
            setFeedback({
                tipo: 'erro',
                texto: e.message || 'Não foi possível remover o item.',
            });
        }
    }

    async function calcularFrete(e) {
        e.preventDefault();
        setFeedback(null);
        setCalculandoFrete(true);
        try {
            const atualizado = await apiCarrinho.calcularFrete(carrinhoId, { cep });
            setCarrinhoDados(atualizado);
            setCep(atualizado?.cep || cep);
            setFeedback({ tipo: 'sucesso', texto: 'Frete calculado.' });
        } catch (err) {
            setFeedback({
                tipo: 'erro',
                texto: err.message || 'Não foi possível calcular o frete.',
            });
        } finally {
            setCalculandoFrete(false);
        }
    }

    function finalizar() {
        navegar('/checkout');
    }

    return (
        <section className="carrinho">
            <div className="pagina-cabecalho">
                <h1>Carrinho</h1>
                <Link className="link-botao link-botao--secundario" to="/">
                    Continuar comprando
                </Link>
            </div>

            {feedback && (
                <Mensagem tipo={feedback.tipo} onFechar={() => setFeedback(null)}>
                    {feedback.texto}
                </Mensagem>
            )}

            <div className="carrinho__grade">
                <ul className="carrinho__itens">
                    {itens.map((item) => (
                        <ItemCarrinho
                            key={item.produtoId}
                            item={item}
                            produto={produtosMap[item.produtoId]}
                            aoAlterar={alterarQuantidade}
                            aoRemover={removerItem}
                        />
                    ))}
                </ul>

                <aside className="carrinho__resumo">
                    <h2 className="carrinho__resumo-titulo">Resumo</h2>

                    <form className="carrinho__frete" onSubmit={calcularFrete}>
                        <label className="form__label" htmlFor="cep">
                            CEP de entrega
                        </label>
                        <div className="carrinho__frete-linha">
                            <input
                                id="cep"
                                className="form__controle"
                                type="text"
                                inputMode="numeric"
                                placeholder="00000-000"
                                value={cep}
                                onChange={(ev) => setCep(ev.target.value)}
                            />
                            <Botao
                                type="submit"
                                variante="secundario"
                                carregando={calculandoFrete}
                            >
                                Calcular frete
                            </Botao>
                        </div>
                    </form>

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

                    <Botao onClick={finalizar} disabled={itens.length === 0}>
                        Finalizar compra
                    </Botao>
                </aside>
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// Linha de item do carrinho, com controle de quantidade e remoção. Mantém
// estados de carregamento próprios por operação para feedback localizado.
// ---------------------------------------------------------------------------
function ItemCarrinho({ item, produto, aoAlterar, aoRemover }) {
    const [alterando, setAlterando] = useState(false);
    const [removendo, setRemovendo] = useState(false);

    const nome = produto?.nome || `Produto ${item.produtoId}`;
    const precoUnitario = Number(item.precoUnitario) || 0;
    const quantidade = Number(item.quantidade) || 0;
    const subtotalLinha = precoUnitario * quantidade;
    const ocupado = alterando || removendo;

    async function definirQuantidade(valor) {
        const n = Math.max(1, Math.floor(Number(valor) || 0));
        if (n === quantidade) {
            return;
        }
        setAlterando(true);
        try {
            await aoAlterar(item.produtoId, n);
        } finally {
            setAlterando(false);
        }
    }

    async function remover() {
        setRemovendo(true);
        try {
            await aoRemover(item.produtoId, nome);
        } finally {
            setRemovendo(false);
        }
    }

    return (
        <li className="item-carrinho">
            <div className="item-carrinho__midia">
                <ImagemProduto src={produto?.imagemUrl} alt={nome} />
            </div>

            <div className="item-carrinho__info">
                <h3 className="item-carrinho__nome">
                    {produto ? (
                        <Link to={`/produto/${item.produtoId}`}>{nome}</Link>
                    ) : (
                        nome
                    )}
                </h3>
                <p className="item-carrinho__preco">
                    {formatarReais(precoUnitario)} / un.
                </p>
            </div>

            <div className="item-carrinho__quantidade">
                <label className="seletor-quantidade">
                    <span>Quantidade</span>
                    <input
                        type="number"
                        min={1}
                        value={quantidade}
                        disabled={ocupado}
                        onChange={(e) => definirQuantidade(e.target.value)}
                    />
                </label>
                {alterando && <Loading inline />}
            </div>

            <div className="item-carrinho__subtotal">
                <span className="item-carrinho__subtotal-rotulo">Subtotal</span>
                <strong>{formatarReais(subtotalLinha)}</strong>
            </div>

            <div className="item-carrinho__acoes">
                <Botao
                    variante="perigo"
                    onClick={remover}
                    carregando={removendo}
                    disabled={alterando}
                >
                    Remover
                </Botao>
            </div>
        </li>
    );
}
