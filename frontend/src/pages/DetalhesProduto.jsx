// ---------------------------------------------------------------------------
// Tela: Detalhes do produto (rota "/produto/:id")
//
// Mostra todas as informações do produto (imagem, nome, descrição, categoria,
// preço, disponibilidade e atributos dinâmicos), com seletor de quantidade e
// ação "adicionar ao carrinho". Toda operação dependente de backend exibe
// loading e mensagem final de sucesso/erro.
// (Requisitos 11.4, 11.8, 11.9)
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { produtos as apiProdutos, carrinho as apiCarrinho } from '../services/api.js';
import { obterOuCriarCarrinhoId } from '../utils/carrinhoId.js';
import { formatarReais } from '../utils/formato.js';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Botao from '../components/ui/Botao.jsx';
import ImagemProduto from '../components/ui/ImagemProduto.jsx';
import Disponibilidade from '../components/ui/Disponibilidade.jsx';

export default function DetalhesProduto() {
    const { id } = useParams();
    const navegar = useNavigate();

    const [produto, setProduto] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');

    const [quantidade, setQuantidade] = useState(1);
    const [adicionando, setAdicionando] = useState(false);
    const [feedback, setFeedback] = useState(null); // { tipo, texto }
    const [excluindo, setExcluindo] = useState(false);

    useEffect(() => {
        let ativo = true;

        async function carregar() {
            setCarregando(true);
            setErro('');
            try {
                const dados = await apiProdutos.obter(id);
                if (ativo) {
                    setProduto(dados);
                    setQuantidade(Number(dados?.estoque) > 0 ? 1 : 0);
                }
            } catch (e) {
                if (ativo) {
                    setErro(e.message || 'Não foi possível carregar o produto.');
                }
            } finally {
                if (ativo) {
                    setCarregando(false);
                }
            }
        }

        carregar();
        return () => {
            ativo = false;
        };
    }, [id]);

    if (carregando) {
        return <Loading texto="Carregando produto..." />;
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

    if (!produto) {
        return null;
    }

    const estoque = Number(produto.estoque) || 0;
    const esgotado = estoque <= 0;
    const atributos = produto.atributos && typeof produto.atributos === 'object'
        ? Object.entries(produto.atributos)
        : [];

    function ajustarQuantidade(valor) {
        const n = Number(valor);
        if (!Number.isFinite(n)) {
            return;
        }
        const limitado = Math.max(1, Math.min(estoque, Math.floor(n)));
        setQuantidade(limitado);
    }

    async function adicionar() {
        setAdicionando(true);
        setFeedback(null);
        try {
            const carrinhoId = await obterOuCriarCarrinhoId();
            await apiCarrinho.adicionarItem(carrinhoId, {
                produtoId: produto.id,
                quantidade,
            });
            setFeedback({
                tipo: 'sucesso',
                texto: `${quantidade} × "${produto.nome}" adicionado(s) ao carrinho.`,
            });
        } catch (e) {
            setFeedback({
                tipo: 'erro',
                texto: e.message || 'Não foi possível adicionar ao carrinho.',
            });
        } finally {
            setAdicionando(false);
        }
    }

    async function excluir() {
        const confirmado = window.confirm(
            `Tem certeza que deseja excluir "${produto.nome}"? Esta ação não pode ser desfeita.`
        );
        if (!confirmado) {
            return;
        }

        setExcluindo(true);
        setFeedback(null);
        try {
            await apiProdutos.remover(produto.id);
            navegar('/');
        } catch (e) {
            setFeedback({
                tipo: 'erro',
                texto: e.message || 'Não foi possível excluir o produto.',
            });
            setExcluindo(false);
        }
    }

    return (
        <section className="detalhes">
            <p className="detalhes__voltar">
                <Link to="/">← Voltar ao catálogo</Link>
            </p>

            <div className="detalhes__grade">
                <div className="detalhes__midia">
                    <ImagemProduto src={produto.imagemUrl} alt={produto.nome} />
                </div>

                <div className="detalhes__info">
                    {produto.categoria && (
                        <span className="detalhes__categoria">{produto.categoria}</span>
                    )}
                    <h1 className="detalhes__nome">{produto.nome}</h1>
                    <p className="detalhes__preco">{formatarReais(produto.preco)}</p>
                    <Disponibilidade estoque={produto.estoque} />

                    {produto.descricao && (
                        <p className="detalhes__descricao">{produto.descricao}</p>
                    )}

                    {atributos.length > 0 && (
                        <div className="atributos">
                            <h2 className="atributos__titulo">Atributos</h2>
                            <dl className="atributos__lista">
                                {atributos.map(([chave, valor]) => (
                                    <div className="atributos__item" key={chave}>
                                        <dt>{chave}</dt>
                                        <dd>{String(valor)}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}

                    <div className="detalhes__compra">
                        <label className="seletor-quantidade">
                            <span>Quantidade</span>
                            <input
                                type="number"
                                min={1}
                                max={estoque}
                                value={esgotado ? 0 : quantidade}
                                disabled={esgotado}
                                onChange={(e) => ajustarQuantidade(e.target.value)}
                            />
                        </label>

                        <Botao
                            onClick={adicionar}
                            carregando={adicionando}
                            disabled={esgotado}
                        >
                            {esgotado ? 'Esgotado' : 'Adicionar ao carrinho'}
                        </Botao>
                    </div>

                    {feedback && (
                        <Mensagem tipo={feedback.tipo} onFechar={() => setFeedback(null)}>
                            {feedback.texto}
                        </Mensagem>
                    )}

                    <div className="detalhes__gestao">
                        <Link
                            className="link-botao link-botao--secundario"
                            to={`/produtos/${produto.id}/editar`}
                        >
                            Editar
                        </Link>
                        <Botao
                            variante="perigo"
                            onClick={excluir}
                            carregando={excluindo}
                        >
                            Excluir
                        </Botao>
                    </div>
                </div>
            </div>
        </section>
    );
}
