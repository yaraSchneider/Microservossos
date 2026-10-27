// ---------------------------------------------------------------------------
// Tela: Detalhes da peça (rota "/produto/:id")
//
// Mostra a peça por inteiro: foto (ou ilustração), marca, nome, etiqueta de
// preço com economia, tamanho e estado, a "ficha da peça" (dados de vestuário
// guardados em `atributos`), a história (descrição) e detalhes extras. Permite
// adicionar à sacola e, na área de bastidores, editar ou excluir a peça.
// Toda operação dependente de backend exibe loading e mensagem final.
// (Requisitos 11.4, 11.8, 11.9)
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { produtos as apiProdutos, carrinho as apiCarrinho } from '../services/api.js';
import { obterOuCriarCarrinhoId } from '../utils/carrinhoId.js';
import { avisarSacolaAtualizada } from '../utils/sacolaEventos.js';
import { formatarReais } from '../utils/formato.js';
import { CORES, ESTADOS, LIMITE_FRETE_GRATIS, lerPeca, rotuloCor, rotuloEstado } from '../utils/peca.js';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Botao from '../components/ui/Botao.jsx';
import Etiqueta from '../components/ui/Etiqueta.jsx';
import Icone from '../components/ui/Icone.jsx';
import ImagemProduto from '../components/ui/ImagemProduto.jsx';
import SeloEstado from '../components/ui/SeloEstado.jsx';
import Disponibilidade from '../components/ui/Disponibilidade.jsx';
import ConfirmarDialogo from '../components/ui/ConfirmarDialogo.jsx';

export default function DetalhesProduto() {
    const { id } = useParams();
    const navegar = useNavigate();
    // Aviso vindo do formulário (ex.: "Peça cadastrada!").
    const { state } = useLocation();

    const [produto, setProduto] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');

    const [quantidade, setQuantidade] = useState(1);
    const [adicionando, setAdicionando] = useState(false);
    const [feedback, setFeedback] = useState(() =>
        state?.aviso ? { tipo: 'sucesso', texto: state.aviso, interno: true } : null
    ); // { tipo, texto, interno? }
    const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
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
                    setErro(e.message || 'Não foi possível carregar a peça.');
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
        return <Loading texto="Carregando a peça..." />;
    }

    if (erro) {
        return (
            <div className="pagina-estreita">
                <Mensagem tipo="erro">{erro}</Mensagem>
                <p>
                    <Link to="/">← Voltar à vitrine</Link>
                </p>
            </div>
        );
    }

    if (!produto) {
        return null;
    }

    const peca = lerPeca(produto);
    const estoque = Number(produto.estoque) || 0;
    const esgotado = estoque <= 0;
    const corHex = CORES[peca.cor]?.hex;

    // Linhas da ficha técnica; campos vazios ficam de fora.
    const ficha = [
        ['Marca', peca.marca],
        ['Tamanho', peca.tamanho],
        ['Estado', peca.estado && rotuloEstado(peca.estado), ESTADOS[peca.estado]?.descricao],
        ['Cor', peca.cor && rotuloCor(peca.cor)],
        ['Tecido', peca.tecido],
        ['Medidas', peca.medidas],
        ['Categoria', produto.categoria],
        ...peca.extras,
    ].filter(([, valor]) => valor);

    function ajustarQuantidade(valor) {
        const n = Number(valor);
        if (!Number.isFinite(n)) {
            return;
        }
        setQuantidade(Math.max(1, Math.min(estoque, Math.floor(n))));
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
            avisarSacolaAtualizada();
            setFeedback({
                tipo: 'sucesso',
                texto:
                    quantidade > 1
                        ? `${quantidade} × "${produto.nome}" foram para a sacola.`
                        : `"${produto.nome}" foi para a sacola.`,
            });
        } catch (e) {
            setFeedback({
                tipo: 'erro',
                texto: e.message || 'Não foi possível adicionar à sacola.',
            });
        } finally {
            setAdicionando(false);
        }
    }

    async function excluir() {
        setExcluindo(true);
        setFeedback(null);
        try {
            await apiProdutos.remover(produto.id);
            navegar('/acervo', {
                state: { aviso: `"${produto.nome}" foi removida do acervo.` },
            });
        } catch (e) {
            setConfirmandoExclusao(false);
            setFeedback({
                tipo: 'erro',
                texto: e.message || 'Não foi possível excluir a peça.',
            });
            setExcluindo(false);
        }
    }

    return (
        <section className="detalhes">
            <nav className="trilha" aria-label="Você está em">
                <Link to="/">Vitrine</Link>
                {produto.categoria && (
                    <>
                        <span aria-hidden="true">/</span>
                        <span>{produto.categoria}</span>
                    </>
                )}
                <span aria-hidden="true">/</span>
                <span aria-current="page">{produto.nome}</span>
            </nav>

            <div className="detalhes__grade">
                <div className="detalhes__midia">
                    <ImagemProduto
                        src={produto.imagemUrl}
                        alt={produto.nome}
                        categoria={produto.categoria}
                        cor={peca.cor}
                    />
                    {esgotado && <span className="carimbo carimbo--grande">Vendida</span>}
                </div>

                <div className="detalhes__info">
                    {peca.marca && <p className="sobretitulo">{peca.marca}</p>}
                    <h1 className="detalhes__nome">{produto.nome}</h1>

                    <div className="detalhes__selos">
                        {peca.tamanho && <span className="chip-tamanho chip-tamanho--grande">Tam. {peca.tamanho}</span>}
                        <SeloEstado estado={peca.estado} />
                        <Disponibilidade estoque={produto.estoque} />
                    </div>

                    <Etiqueta preco={produto.preco} precoOriginal={peca.precoOriginal} tamanho="grande" />

                    <div className="detalhes__compra">
                        {estoque > 1 && (
                            <label className="seletor-quantidade">
                                <span>Quantidade</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={estoque}
                                    value={quantidade}
                                    onChange={(e) => ajustarQuantidade(e.target.value)}
                                />
                            </label>
                        )}

                        <Botao
                            className="botao--largo"
                            onClick={adicionar}
                            carregando={adicionando}
                            disabled={esgotado}
                        >
                            {!adicionando && <Icone nome="sacola" tamanho={20} />}
                            {esgotado ? 'Essa já foi garimpada' : 'Adicionar à sacola'}
                        </Botao>
                    </div>

                    {feedback && (
                        <Mensagem tipo={feedback.tipo} onFechar={() => setFeedback(null)}>
                            {feedback.texto}{' '}
                            {feedback.tipo === 'sucesso' && !feedback.interno && (
                                <Link to="/carrinho">Ver sacola</Link>
                            )}
                        </Mensagem>
                    )}

                    <ul className="garantias">
                        <li>
                            <Icone nome="caminhao" tamanho={18} />
                            Frete grátis em compras acima de {formatarReais(LIMITE_FRETE_GRATIS)}
                        </li>
                        <li>
                            <Icone nome="folha" tamanho={18} />
                            Comprar usado evita uma peça nova sendo produzida
                        </li>
                        {estoque === 1 && (
                            <li>
                                <Icone nome="etiqueta" tamanho={18} />
                                Peça única: quando sai, não volta
                            </li>
                        )}
                    </ul>

                    {ficha.length > 0 && (
                        <div className="ficha">
                            <h2 className="ficha__titulo">Ficha da peça</h2>
                            <dl className="ficha__lista">
                                {ficha.map(([rotulo, valor, ajuda]) => (
                                    <div className="ficha__item" key={rotulo}>
                                        <dt>{rotulo}</dt>
                                        <dd>
                                            {rotulo === 'Cor' && corHex && (
                                                <span
                                                    className={`amostra-cor ${corHex === 'estampa' ? 'amostra-cor--estampa' : ''}`}
                                                    style={corHex !== 'estampa' ? { background: corHex } : undefined}
                                                    aria-hidden="true"
                                                />
                                            )}
                                            {String(valor)}
                                            {ajuda && <small>{ajuda}</small>}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}

                    {produto.descricao && (
                        <div className="historia">
                            <h2 className="ficha__titulo">A história da peça</h2>
                            <p>{produto.descricao}</p>
                        </div>
                    )}

                    <div className="bastidores">
                        <div>
                            <p className="bastidores__titulo">Bastidores do acervo</p>
                            <p className="bastidores__texto">
                                Código <code>{produto.id}</code> · {estoque} em estoque
                            </p>
                        </div>
                        <div className="bastidores__acoes">
                            <Link
                                className="link-botao link-botao--secundario link-botao--pequeno"
                                to={`/produtos/${produto.id}/editar`}
                            >
                                <Icone nome="lapis" tamanho={16} /> Editar
                            </Link>
                            <Botao
                                variante="perigo-suave"
                                className="botao--pequeno"
                                onClick={() => setConfirmandoExclusao(true)}
                            >
                                <Icone nome="lixeira" tamanho={16} /> Excluir
                            </Botao>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmarDialogo
                aberto={confirmandoExclusao}
                titulo="Excluir esta peça?"
                rotuloConfirmar="Excluir peça"
                carregando={excluindo}
                onConfirmar={excluir}
                onCancelar={() => setConfirmandoExclusao(false)}
            >
                <p>
                    <strong>{produto.nome}</strong> sairá da vitrine e do acervo. Essa ação não
                    pode ser desfeita.
                </p>
            </ConfirmarDialogo>
        </section>
    );
}
