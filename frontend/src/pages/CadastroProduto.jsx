// ---------------------------------------------------------------------------
// Tela: Cadastro / edição de produtos (rotas "/produtos/novo" e
// "/produtos/:id/editar")
//
// Formulário único usado tanto para CRIAR quanto para EDITAR um produto, com:
//  - Campos: nome (obrigatório), descrição, categoria, preço (em REAIS para o
//    usuário; convertido para centavos antes de enviar), estoque e imagem.
//  - Atributos personalizados DINÂMICOS: lista de pares chave/valor com ações
//    de adicionar e remover, além de uma pré-visualização do mapa que será
//    salvo. (Requisitos 11.2, 11.3)
//
// Toda operação dependente de backend exibe loading e, ao final, mensagem de
// sucesso ou erro amigável (o backend responde `{ erro }`). (Requisitos 11.8)
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { produtos as apiProdutos } from '../services/api.js';
import { formatarReais } from '../utils/formato.js';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Botao from '../components/ui/Botao.jsx';

// --- Conversão de preço pt-BR (reais <-> centavos) --------------------------

/**
 * Converte um texto em reais (aceitando vírgula ou ponto como separador
 * decimal e separadores de milhar) para centavos inteiros.
 * Retorna `null` quando o valor é inválido.
 *
 * Ex.: "35,00" -> 3500 · "1.234,56" -> 123456 · "3500" -> 350000
 *
 * @param {string} texto
 * @returns {number|null}
 */
export function reaisParaCentavos(texto) {
    if (texto === null || texto === undefined) {
        return null;
    }
    let limpo = String(texto).trim();
    if (limpo === '') {
        return null;
    }

    // Normaliza o separador decimal para ".": se houver vírgula, assume-se que
    // ela é o separador decimal e os pontos são separadores de milhar.
    if (limpo.includes(',')) {
        limpo = limpo.replace(/\./g, '').replace(',', '.');
    }

    const valor = Number(limpo);
    if (!Number.isFinite(valor) || valor < 0) {
        return null;
    }
    return Math.round(valor * 100);
}

/**
 * Converte centavos (inteiro) para um texto em reais com vírgula decimal,
 * apropriado para preencher o input de preço na edição.
 *
 * Ex.: 3500 -> "35,00"
 *
 * @param {number} centavos
 * @returns {string}
 */
export function centavosParaReaisInput(centavos) {
    const valor = Number(centavos);
    if (!Number.isFinite(valor)) {
        return '';
    }
    return (valor / 100).toFixed(2).replace('.', ',');
}

// --- Atributos dinâmicos ----------------------------------------------------

/** Converte o objeto de atributos do backend em lista de pares para o form. */
function atributosParaPares(atributos) {
    if (!atributos || typeof atributos !== 'object') {
        return [];
    }
    return Object.entries(atributos).map(([chave, valor]) => ({
        chave: String(chave),
        valor: valor === null || valor === undefined ? '' : String(valor),
    }));
}

/**
 * Converte a lista de pares do form no mapa `{ chave: valor }` que será salvo,
 * ignorando pares cuja chave esteja vazia.
 *
 * @param {{ chave: string, valor: string }[]} pares
 * @returns {Record<string, string>}
 */
export function paresParaAtributos(pares) {
    const mapa = {};
    for (const par of pares) {
        const chave = (par.chave || '').trim();
        if (chave) {
            mapa[chave] = (par.valor ?? '').trim();
        }
    }
    return mapa;
}

export default function CadastroProduto() {
    const { id } = useParams();
    const navegar = useNavigate();
    const modoEdicao = Boolean(id);

    // Campos do formulário.
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [categoria, setCategoria] = useState('');
    const [preco, setPreco] = useState(''); // em reais (texto)
    const [estoque, setEstoque] = useState('');
    const [imagemUrl, setImagemUrl] = useState('');
    const [pares, setPares] = useState([]); // [{ chave, valor }]

    // Estados de carregamento inicial (edição) e de envio.
    const [carregando, setCarregando] = useState(modoEdicao);
    const [erroCarregar, setErroCarregar] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [feedback, setFeedback] = useState(null); // { tipo, texto }

    // Carrega o produto no modo edição para pré-preencher o formulário.
    useEffect(() => {
        if (!modoEdicao) {
            return undefined;
        }

        let ativo = true;

        async function carregar() {
            setCarregando(true);
            setErroCarregar('');
            try {
                const dados = await apiProdutos.obter(id);
                if (!ativo) {
                    return;
                }
                setNome(dados?.nome ?? '');
                setDescricao(dados?.descricao ?? '');
                setCategoria(dados?.categoria ?? '');
                setPreco(centavosParaReaisInput(dados?.preco ?? 0));
                setEstoque(String(dados?.estoque ?? 0));
                setImagemUrl(dados?.imagemUrl ?? '');
                setPares(atributosParaPares(dados?.atributos));
            } catch (e) {
                if (ativo) {
                    setErroCarregar(e.message || 'Não foi possível carregar o produto.');
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
    }, [id, modoEdicao]);

    // --- Manipulação dos atributos dinâmicos --------------------------------
    function adicionarAtributo() {
        setPares((atual) => [...atual, { chave: '', valor: '' }]);
    }

    function alterarAtributo(indice, campo, valor) {
        setPares((atual) =>
            atual.map((par, i) => (i === indice ? { ...par, [campo]: valor } : par))
        );
    }

    function removerAtributo(indice) {
        setPares((atual) => atual.filter((_, i) => i !== indice));
    }

    // Pré-visualização do mapa de atributos que será efetivamente salvo.
    const atributosPrevia = paresParaAtributos(pares);
    const previaEntradas = Object.entries(atributosPrevia);

    // --- Envio --------------------------------------------------------------
    async function enviar(evento) {
        evento.preventDefault();
        setFeedback(null);

        // Validação leve no cliente para feedback imediato (o backend valida
        // novamente e é a fonte de verdade).
        if (!nome.trim()) {
            setFeedback({ tipo: 'erro', texto: 'Nome é obrigatório.' });
            return;
        }

        const precoCentavos = reaisParaCentavos(preco);
        if (precoCentavos === null) {
            setFeedback({ tipo: 'erro', texto: 'Preço inválido.' });
            return;
        }

        const estoqueNum = Number(estoque);
        if (!Number.isInteger(estoqueNum) || estoqueNum < 0) {
            setFeedback({
                tipo: 'erro',
                texto: 'Estoque não pode ser negativo.',
            });
            return;
        }

        const dados = {
            nome: nome.trim(),
            descricao: descricao.trim(),
            categoria: categoria.trim(),
            preco: precoCentavos,
            estoque: estoqueNum,
            imagemUrl: imagemUrl.trim(),
            atributos: paresParaAtributos(pares),
        };

        setEnviando(true);
        try {
            if (modoEdicao) {
                await apiProdutos.atualizar(id, dados);
                setFeedback({ tipo: 'sucesso', texto: 'Produto atualizado com sucesso.' });
            } else {
                const criado = await apiProdutos.criar(dados);
                setFeedback({ tipo: 'sucesso', texto: 'Produto criado com sucesso.' });
                // Redireciona para os detalhes do novo produto quando houver id.
                if (criado && criado.id !== undefined) {
                    navegar(`/produto/${criado.id}`);
                    return;
                }
                navegar('/');
                return;
            }
        } catch (e) {
            setFeedback({
                tipo: 'erro',
                texto: e.message || 'Não foi possível salvar o produto.',
            });
        } finally {
            setEnviando(false);
        }
    }

    if (carregando) {
        return <Loading texto="Carregando produto..." />;
    }

    if (erroCarregar) {
        return (
            <div>
                <Mensagem tipo="erro">{erroCarregar}</Mensagem>
                <p>
                    <Link to="/">← Voltar ao catálogo</Link>
                </p>
            </div>
        );
    }

    return (
        <section className="formulario-produto">
            <div className="pagina-cabecalho">
                <h1>{modoEdicao ? 'Editar produto' : 'Novo produto'}</h1>
                <Link className="link-botao link-botao--secundario" to="/">
                    ← Voltar
                </Link>
            </div>

            <form className="form" onSubmit={enviar} noValidate>
                <div className="form__grupo">
                    <label className="form__label" htmlFor="campo-nome">
                        Nome <span aria-hidden="true">*</span>
                    </label>
                    <input
                        id="campo-nome"
                        type="text"
                        className="form__controle"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                    />
                </div>

                <div className="form__grupo">
                    <label className="form__label" htmlFor="campo-descricao">
                        Descrição
                    </label>
                    <textarea
                        id="campo-descricao"
                        className="form__controle"
                        rows={3}
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                    />
                </div>

                <div className="form__linha">
                    <div className="form__grupo">
                        <label className="form__label" htmlFor="campo-categoria">
                            Categoria
                        </label>
                        <input
                            id="campo-categoria"
                            type="text"
                            className="form__controle"
                            value={categoria}
                            onChange={(e) => setCategoria(e.target.value)}
                        />
                    </div>

                    <div className="form__grupo">
                        <label className="form__label" htmlFor="campo-preco">
                            Preço (R$)
                        </label>
                        <input
                            id="campo-preco"
                            type="text"
                            inputMode="decimal"
                            className="form__controle"
                            placeholder="Ex.: 35,00"
                            value={preco}
                            onChange={(e) => setPreco(e.target.value)}
                        />
                        <small className="form__ajuda">
                            {reaisParaCentavos(preco) !== null
                                ? `Será salvo como ${formatarReais(reaisParaCentavos(preco))}.`
                                : 'Use vírgula para os centavos.'}
                        </small>
                    </div>

                    <div className="form__grupo">
                        <label className="form__label" htmlFor="campo-estoque">
                            Estoque
                        </label>
                        <input
                            id="campo-estoque"
                            type="number"
                            min={0}
                            step={1}
                            className="form__controle"
                            value={estoque}
                            onChange={(e) => setEstoque(e.target.value)}
                        />
                    </div>
                </div>

                <div className="form__grupo">
                    <label className="form__label" htmlFor="campo-imagem">
                        URL da imagem
                    </label>
                    <input
                        id="campo-imagem"
                        type="url"
                        className="form__controle"
                        placeholder="https://..."
                        value={imagemUrl}
                        onChange={(e) => setImagemUrl(e.target.value)}
                    />
                </div>

                {/* Atributos personalizados dinâmicos */}
                <fieldset className="form__secao">
                    <legend className="form__secao-titulo">Atributos personalizados</legend>

                    {pares.length === 0 ? (
                        <p className="form__ajuda">
                            Nenhum atributo adicionado. Use o botão abaixo para incluir pares
                            de nome e valor (ex.: cor / prata).
                        </p>
                    ) : (
                        <div className="atributos-editor">
                            {pares.map((par, indice) => (
                                <div className="atributos-editor__linha" key={indice}>
                                    <input
                                        type="text"
                                        className="form__controle"
                                        placeholder="Nome (ex.: cor)"
                                        aria-label={`Nome do atributo ${indice + 1}`}
                                        value={par.chave}
                                        onChange={(e) =>
                                            alterarAtributo(indice, 'chave', e.target.value)
                                        }
                                    />
                                    <input
                                        type="text"
                                        className="form__controle"
                                        placeholder="Valor (ex.: prata)"
                                        aria-label={`Valor do atributo ${indice + 1}`}
                                        value={par.valor}
                                        onChange={(e) =>
                                            alterarAtributo(indice, 'valor', e.target.value)
                                        }
                                    />
                                    <Botao
                                        type="button"
                                        variante="perigo"
                                        onClick={() => removerAtributo(indice)}
                                    >
                                        Remover
                                    </Botao>
                                </div>
                            ))}
                        </div>
                    )}

                    <Botao type="button" variante="secundario" onClick={adicionarAtributo}>
                        + Adicionar atributo
                    </Botao>

                    {/* Pré-visualização do mapa que será salvo */}
                    {previaEntradas.length > 0 && (
                        <div className="atributos-previa">
                            <h3 className="atributos-previa__titulo">Pré-visualização</h3>
                            <dl className="atributos__lista">
                                {previaEntradas.map(([chave, valor]) => (
                                    <div className="atributos__item" key={chave}>
                                        <dt>{chave}</dt>
                                        <dd>{valor || '—'}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                </fieldset>

                {feedback && (
                    <Mensagem tipo={feedback.tipo} onFechar={() => setFeedback(null)}>
                        {feedback.texto}
                    </Mensagem>
                )}

                <div className="form__acoes">
                    <Botao type="submit" carregando={enviando}>
                        {modoEdicao ? 'Salvar alterações' : 'Criar produto'}
                    </Botao>
                    <Link className="link-botao link-botao--secundario" to="/">
                        Cancelar
                    </Link>
                </div>
            </form>
        </section>
    );
}
