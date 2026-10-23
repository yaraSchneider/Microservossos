// ---------------------------------------------------------------------------
// Tela: Catálogo (rota "/")
//
// Lista os produtos em cards (imagem, nome, preço, categoria, disponibilidade)
// com ações "Ver detalhes" e "Adicionar ao carrinho". Toda operação dependente
// de backend exibe loading e mensagem final de sucesso/erro.
// (Requisitos 11.1, 11.8, 11.9)
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { produtos as apiProdutos, carrinho as apiCarrinho } from '../services/api.js';
import { obterOuCriarCarrinhoId } from '../utils/carrinhoId.js';
import { formatarReais } from '../utils/formato.js';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Botao from '../components/ui/Botao.jsx';
import ImagemProduto from '../components/ui/ImagemProduto.jsx';
import Disponibilidade from '../components/ui/Disponibilidade.jsx';

export default function Catalogo() {
    const [lista, setLista] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');

    // Feedback da ação "adicionar ao carrinho" (banner global).
    const [feedback, setFeedback] = useState(null); // { tipo, texto }

    useEffect(() => {
        let ativo = true;

        async function carregar() {
            setCarregando(true);
            setErro('');
            try {
                const dados = await apiProdutos.listar();
                if (ativo) {
                    setLista(Array.isArray(dados) ? dados : []);
                }
            } catch (e) {
                if (ativo) {
                    setErro(e.message || 'Não foi possível carregar os produtos.');
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
    }, []);

    if (carregando) {
        return <Loading texto="Carregando produtos..." />;
    }

    if (erro) {
        return (
            <Mensagem tipo="erro">
                {erro} Recarregue a página para tentar novamente.
            </Mensagem>
        );
    }

    return (
        <section>
            <div className="pagina-cabecalho">
                <h1>Catálogo</h1>
                <Link className="link-botao" to="/produtos/novo">
                    + Novo produto
                </Link>
            </div>

            {feedback && (
                <Mensagem tipo={feedback.tipo} onFechar={() => setFeedback(null)}>
                    {feedback.texto}
                </Mensagem>
            )}

            {lista.length === 0 ? (
                <Mensagem tipo="info">
                    Nenhum produto cadastrado ainda.{' '}
                    <Link to="/produtos/novo">Cadastre o primeiro produto</Link>.
                </Mensagem>
            ) : (
                <div className="grade-produtos">
                    {lista.map((produto) => (
                        <CardProduto
                            key={produto.id}
                            produto={produto}
                            aoNotificar={setFeedback}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

// ---------------------------------------------------------------------------
// Card individual do produto com ação "adicionar ao carrinho" com estado de
// carregamento próprio por card.
// ---------------------------------------------------------------------------
function CardProduto({ produto, aoNotificar }) {
    const [adicionando, setAdicionando] = useState(false);
    const esgotado = Number(produto.estoque) <= 0;

    async function adicionar() {
        setAdicionando(true);
        try {
            const carrinhoId = await obterOuCriarCarrinhoId();
            await apiCarrinho.adicionarItem(carrinhoId, {
                produtoId: produto.id,
                quantidade: 1,
            });
            aoNotificar({
                tipo: 'sucesso',
                texto: `"${produto.nome}" adicionado ao carrinho.`,
            });
        } catch (e) {
            aoNotificar({
                tipo: 'erro',
                texto: e.message || 'Não foi possível adicionar ao carrinho.',
            });
        } finally {
            setAdicionando(false);
        }
    }

    return (
        <article className="card-produto">
            <Link to={`/produto/${produto.id}`} className="card-produto__midia">
                <ImagemProduto src={produto.imagemUrl} alt={produto.nome} />
            </Link>

            <div className="card-produto__corpo">
                {produto.categoria && (
                    <span className="card-produto__categoria">{produto.categoria}</span>
                )}
                <h2 className="card-produto__nome">
                    <Link to={`/produto/${produto.id}`}>{produto.nome}</Link>
                </h2>
                <p className="card-produto__preco">{formatarReais(produto.preco)}</p>
                <Disponibilidade estoque={produto.estoque} />
            </div>

            <div className="card-produto__acoes">
                <Link className="link-botao link-botao--secundario" to={`/produto/${produto.id}`}>
                    Ver detalhes
                </Link>
                <Botao
                    onClick={adicionar}
                    carregando={adicionando}
                    disabled={esgotado}
                >
                    {esgotado ? 'Esgotado' : 'Adicionar ao carrinho'}
                </Botao>
            </div>
        </article>
    );
}
