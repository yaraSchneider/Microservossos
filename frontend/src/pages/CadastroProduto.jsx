// ---------------------------------------------------------------------------
// Tela: Cadastro / edição de peças (rotas "/produtos/novo" e
// "/produtos/:id/editar")
//
// Formulário único usado tanto para CRIAR quanto para EDITAR uma peça, em
// seções: a peça (nome, categoria, história), detalhes de vestuário (tamanho,
// marca, estado, cor, tecido, medidas), preço e estoque, foto e "outros
// detalhes". Ao lado, uma pré-visualização mostra o card como ficará na
// vitrine.
//
// Os dados de vestuário são gravados em chaves conhecidas de `atributos` (ver
// utils/peca.js); os "outros detalhes" continuam sendo atributos DINÂMICOS com
// ações de adicionar e remover. (Requisitos 11.2, 11.3)
//
// Toda operação dependente de backend exibe loading e, ao final, mensagem de
// sucesso ou erro amigável (o backend responde `{ erro }`). (Requisitos 11.8)
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { produtos as apiProdutos } from '../services/api.js';
import { formatarReais } from '../utils/formato.js';
import { CATEGORIAS, CORES, ESTADOS, TAMANHOS, lerPeca } from '../utils/peca.js';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Botao from '../components/ui/Botao.jsx';
import Etiqueta from '../components/ui/Etiqueta.jsx';
import Icone from '../components/ui/Icone.jsx';
import ImagemProduto from '../components/ui/ImagemProduto.jsx';
import SeloEstado from '../components/ui/SeloEstado.jsx';
import { textoDisponibilidade } from '../components/ui/Disponibilidade.jsx';

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

/** Lista de opções canônicas acrescida do valor atual, se ele for livre. */
function comValorAtual(opcoes, atual) {
    return atual && !opcoes.includes(atual) ? [...opcoes, atual] : opcoes;
}

const VESTUARIO_VAZIO = {
    tamanho: '',
    marca: '',
    estado: '',
    cor: '',
    tecido: '',
    medidas: '',
};

export default function CadastroProduto() {
    const { id } = useParams();
    const navegar = useNavigate();
    const modoEdicao = Boolean(id);

    // Campos do formulário.
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [categoria, setCategoria] = useState('');
    const [preco, setPreco] = useState(''); // em reais (texto)
    const [precoOriginal, setPrecoOriginal] = useState(''); // em reais (texto)
    const [estoque, setEstoque] = useState('1'); // brechó: peça única por padrão
    const [imagemUrl, setImagemUrl] = useState('');
    const [vestuario, setVestuario] = useState(VESTUARIO_VAZIO);
    const [pares, setPares] = useState([]); // detalhes extras [{ chave, valor }]

    // Estados de carregamento inicial (edição) e de envio.
    const [carregando, setCarregando] = useState(modoEdicao);
    const [erroCarregar, setErroCarregar] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [feedback, setFeedback] = useState(null); // { tipo, texto }

    // Carrega a peça no modo edição para pré-preencher o formulário.
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
                const peca = lerPeca(dados);
                setNome(dados?.nome ?? '');
                setDescricao(dados?.descricao ?? '');
                setCategoria(dados?.categoria ?? '');
                setPreco(centavosParaReaisInput(dados?.preco ?? 0));
                setPrecoOriginal(peca.precoOriginal ? centavosParaReaisInput(peca.precoOriginal) : '');
                setEstoque(String(dados?.estoque ?? 0));
                setImagemUrl(dados?.imagemUrl ?? '');
                setVestuario({
                    tamanho: peca.tamanho,
                    marca: peca.marca,
                    estado: peca.estado,
                    cor: peca.cor,
                    tecido: peca.tecido,
                    medidas: peca.medidas,
                });
                setPares(peca.extras.map(([chave, valor]) => ({ chave, valor: String(valor ?? '') })));
            } catch (e) {
                if (ativo) {
                    setErroCarregar(e.message || 'Não foi possível carregar a peça.');
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

    function alterarVestuario(campo, valor) {
        setVestuario((atual) => ({ ...atual, [campo]: valor }));
    }

    // Clicar de novo numa opção já marcada desmarca (campos opcionais).
    function alternarVestuario(campo, valor) {
        setVestuario((atual) => ({ ...atual, [campo]: atual[campo] === valor ? '' : valor }));
    }

    // --- Manipulação dos detalhes extras (atributos dinâmicos) --------------
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

    /** Mapa final de atributos: extras + dados de vestuário preenchidos. */
    function montarAtributos(precoOriginalCentavos) {
        const atributos = paresParaAtributos(pares);
        for (const [chave, valor] of Object.entries(vestuario)) {
            if (valor.trim()) {
                atributos[chave] = valor.trim();
            } else {
                delete atributos[chave];
            }
        }
        if (precoOriginalCentavos) {
            atributos.precoOriginal = String(precoOriginalCentavos);
        } else {
            delete atributos.precoOriginal;
        }
        return atributos;
    }

    // --- Pré-visualização ---------------------------------------------------
    const precoCentavosPrevia = reaisParaCentavos(preco);
    const precoOriginalPrevia = reaisParaCentavos(precoOriginal);
    const estoquePrevia = Number.parseInt(estoque, 10);

    // --- Envio --------------------------------------------------------------
    async function enviar(evento) {
        evento.preventDefault();
        setFeedback(null);

        // Validação leve no cliente para feedback imediato (o backend valida
        // novamente e é a fonte de verdade).
        if (!nome.trim()) {
            setFeedback({ tipo: 'erro', texto: 'Dê um nome para a peça.' });
            return;
        }

        const precoCentavos = reaisParaCentavos(preco);
        if (precoCentavos === null) {
            setFeedback({ tipo: 'erro', texto: 'Preço inválido. Use, por exemplo, 89,90.' });
            return;
        }

        const precoOriginalCentavos = precoOriginal.trim() ? reaisParaCentavos(precoOriginal) : null;
        if (precoOriginal.trim() && precoOriginalCentavos === null) {
            setFeedback({ tipo: 'erro', texto: 'Preço original inválido.' });
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
            atributos: montarAtributos(precoOriginalCentavos),
        };

        setEnviando(true);
        try {
            if (modoEdicao) {
                await apiProdutos.atualizar(id, dados);
                navegar(`/produto/${id}`, {
                    state: { aviso: 'Alterações salvas.' },
                });
                return;
            }
            const criado = await apiProdutos.criar(dados);
            // Redireciona para os detalhes da nova peça quando houver id.
            if (criado && criado.id !== undefined) {
                navegar(`/produto/${criado.id}`, {
                    state: { aviso: 'Peça cadastrada! Ela já está na vitrine.' },
                });
                return;
            }
            navegar('/acervo');
        } catch (e) {
            setFeedback({
                tipo: 'erro',
                texto: e.message || 'Não foi possível salvar a peça.',
            });
            setEnviando(false);
        }
    }

    if (carregando) {
        return <Loading texto="Carregando a peça..." />;
    }

    if (erroCarregar) {
        return (
            <div className="pagina-estreita">
                <Mensagem tipo="erro">{erroCarregar}</Mensagem>
                <p>
                    <Link to="/acervo">← Voltar ao acervo</Link>
                </p>
            </div>
        );
    }

    const voltarPara = modoEdicao ? `/produto/${id}` : '/acervo';

    return (
        <section className="formulario-peca">
            <div className="pagina-cabecalho">
                <div>
                    <p className="sobretitulo">{modoEdicao ? 'Acervo · edição' : 'Acervo · nova peça'}</p>
                    <h1>{modoEdicao ? 'Editar peça' : 'Cadastrar peça'}</h1>
                </div>
                <Link className="link-botao link-botao--secundario" to={voltarPara}>
                    <Icone nome="voltar" tamanho={18} /> Voltar
                </Link>
            </div>

            <div className="formulario-peca__grade">
                <form className="form" onSubmit={enviar} noValidate>
                    {/* 1. A peça */}
                    <fieldset className="form__secao">
                        <legend className="form__secao-titulo">
                            <span className="form__secao-numero">1</span> A peça
                        </legend>

                        <div className="form__grupo">
                            <label className="form__label" htmlFor="campo-nome">
                                Nome <span aria-hidden="true">*</span>
                            </label>
                            <input
                                id="campo-nome"
                                type="text"
                                className="form__controle"
                                placeholder="Ex.: Jaqueta jeans oversized anos 90"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form__grupo">
                            <span className="form__label" id="rotulo-categoria">
                                Categoria
                            </span>
                            <div className="opcoes" role="radiogroup" aria-labelledby="rotulo-categoria">
                                {comValorAtual(CATEGORIAS, categoria).map((c) => (
                                    <button
                                        type="button"
                                        key={c}
                                        role="radio"
                                        aria-checked={categoria === c}
                                        className={`chip ${categoria === c ? 'chip--ativo' : ''}`}
                                        onClick={() => setCategoria(categoria === c ? '' : c)}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form__grupo">
                            <label className="form__label" htmlFor="campo-descricao">
                                A história da peça
                            </label>
                            <textarea
                                id="campo-descricao"
                                className="form__controle"
                                rows={4}
                                placeholder="De onde ela veio, como veste, com o que combina, algum detalhe que vale contar..."
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                            />
                        </div>
                    </fieldset>

                    {/* 2. Detalhes de vestuário */}
                    <fieldset className="form__secao">
                        <legend className="form__secao-titulo">
                            <span className="form__secao-numero">2</span> Detalhes
                        </legend>

                        <div className="form__grupo">
                            <span className="form__label" id="rotulo-tamanho">
                                Tamanho
                            </span>
                            <div className="opcoes" role="radiogroup" aria-labelledby="rotulo-tamanho">
                                {comValorAtual(TAMANHOS, vestuario.tamanho).map((t) => (
                                    <button
                                        type="button"
                                        key={t}
                                        role="radio"
                                        aria-checked={vestuario.tamanho === t}
                                        className={`chip chip--quadrado ${vestuario.tamanho === t ? 'chip--ativo' : ''}`}
                                        onClick={() => alternarVestuario('tamanho', t)}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form__grupo">
                            <span className="form__label" id="rotulo-estado">
                                Estado de conservação
                            </span>
                            <div className="opcoes-estado" role="radiogroup" aria-labelledby="rotulo-estado">
                                {Object.entries(ESTADOS).map(([chave, info]) => (
                                    <button
                                        type="button"
                                        key={chave}
                                        role="radio"
                                        aria-checked={vestuario.estado === chave}
                                        className={`opcao-estado ${vestuario.estado === chave ? 'opcao-estado--ativa' : ''}`}
                                        onClick={() => alternarVestuario('estado', chave)}
                                    >
                                        <strong>{info.rotulo}</strong>
                                        <span>{info.descricao}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form__grupo">
                            <span className="form__label" id="rotulo-cor">
                                Cor {vestuario.cor && <em className="form__valor">{CORES[vestuario.cor]?.rotulo || vestuario.cor}</em>}
                            </span>
                            <div className="opcoes-cor" role="radiogroup" aria-labelledby="rotulo-cor">
                                {Object.entries(CORES).map(([chave, info]) => (
                                    <button
                                        type="button"
                                        key={chave}
                                        role="radio"
                                        aria-checked={vestuario.cor === chave}
                                        aria-label={info.rotulo}
                                        title={info.rotulo}
                                        className={`amostra-cor amostra-cor--botao ${info.hex === 'estampa' ? 'amostra-cor--estampa' : ''} ${vestuario.cor === chave ? 'amostra-cor--ativa' : ''}`}
                                        style={info.hex !== 'estampa' ? { background: info.hex } : undefined}
                                        onClick={() => alternarVestuario('cor', chave)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="form__linha">
                            <div className="form__grupo">
                                <label className="form__label" htmlFor="campo-marca">
                                    Marca
                                </label>
                                <input
                                    id="campo-marca"
                                    type="text"
                                    className="form__controle"
                                    placeholder="Ex.: Levi's, Farm, sem marca"
                                    value={vestuario.marca}
                                    onChange={(e) => alterarVestuario('marca', e.target.value)}
                                />
                            </div>
                            <div className="form__grupo">
                                <label className="form__label" htmlFor="campo-tecido">
                                    Tecido
                                </label>
                                <input
                                    id="campo-tecido"
                                    type="text"
                                    className="form__controle"
                                    placeholder="Ex.: 100% algodão"
                                    value={vestuario.tecido}
                                    onChange={(e) => alterarVestuario('tecido', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form__grupo">
                            <label className="form__label" htmlFor="campo-medidas">
                                Medidas
                            </label>
                            <input
                                id="campo-medidas"
                                type="text"
                                className="form__controle"
                                placeholder="Ex.: Busto 96 cm · Comprimento 68 cm"
                                value={vestuario.medidas}
                                onChange={(e) => alterarVestuario('medidas', e.target.value)}
                            />
                            <small className="form__ajuda">
                                Medidas da peça deitada ajudam muito quem compra sem provar.
                            </small>
                        </div>
                    </fieldset>

                    {/* 3. Preço e estoque */}
                    <fieldset className="form__secao">
                        <legend className="form__secao-titulo">
                            <span className="form__secao-numero">3</span> Preço e estoque
                        </legend>

                        <div className="form__linha form__linha--3">
                            <div className="form__grupo">
                                <label className="form__label" htmlFor="campo-preco">
                                    Preço no brechó (R$) <span aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="campo-preco"
                                    type="text"
                                    inputMode="decimal"
                                    className="form__controle"
                                    placeholder="Ex.: 89,90"
                                    value={preco}
                                    onChange={(e) => setPreco(e.target.value)}
                                />
                                <small className="form__ajuda">
                                    {precoCentavosPrevia !== null
                                        ? `Será salvo como ${formatarReais(precoCentavosPrevia)}.`
                                        : 'Use vírgula para os centavos.'}
                                </small>
                            </div>

                            <div className="form__grupo">
                                <label className="form__label" htmlFor="campo-preco-original">
                                    Preço original (R$)
                                </label>
                                <input
                                    id="campo-preco-original"
                                    type="text"
                                    inputMode="decimal"
                                    className="form__controle"
                                    placeholder="Opcional"
                                    value={precoOriginal}
                                    onChange={(e) => setPrecoOriginal(e.target.value)}
                                />
                                <small className="form__ajuda">Quanto custava nova, para mostrar a economia.</small>
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
                                <small className="form__ajuda">No brechó quase sempre é 1: peça única.</small>
                            </div>
                        </div>
                    </fieldset>

                    {/* 4. Foto */}
                    <fieldset className="form__secao">
                        <legend className="form__secao-titulo">
                            <span className="form__secao-numero">4</span> Foto
                        </legend>
                        <div className="form__grupo">
                            <label className="form__label" htmlFor="campo-imagem">
                                URL da foto
                            </label>
                            <input
                                id="campo-imagem"
                                type="url"
                                className="form__controle"
                                placeholder="https://..."
                                value={imagemUrl}
                                onChange={(e) => setImagemUrl(e.target.value)}
                            />
                            <small className="form__ajuda">
                                Sem foto? Tudo bem: a vitrine mostra uma ilustração da peça na cor escolhida.
                            </small>
                        </div>
                    </fieldset>

                    {/* 5. Outros detalhes (atributos personalizados dinâmicos) */}
                    <fieldset className="form__secao">
                        <legend className="form__secao-titulo">
                            <span className="form__secao-numero">5</span> Outros detalhes
                        </legend>

                        {pares.length === 0 ? (
                            <p className="form__ajuda">
                                Algo mais que vale registrar? Adicione pares de nome e valor (ex.:
                                década / anos 80, forro / sim).
                            </p>
                        ) : (
                            <div className="atributos-editor">
                                {pares.map((par, indice) => (
                                    <div className="atributos-editor__linha" key={indice}>
                                        <input
                                            type="text"
                                            className="form__controle"
                                            placeholder="Nome (ex.: década)"
                                            aria-label={`Nome do atributo ${indice + 1}`}
                                            value={par.chave}
                                            onChange={(e) =>
                                                alterarAtributo(indice, 'chave', e.target.value)
                                            }
                                        />
                                        <input
                                            type="text"
                                            className="form__controle"
                                            placeholder="Valor (ex.: anos 80)"
                                            aria-label={`Valor do atributo ${indice + 1}`}
                                            value={par.valor}
                                            onChange={(e) =>
                                                alterarAtributo(indice, 'valor', e.target.value)
                                            }
                                        />
                                        <button
                                            type="button"
                                            className="botao-icone"
                                            onClick={() => removerAtributo(indice)}
                                            aria-label={`Remover atributo ${indice + 1}`}
                                            title="Remover"
                                        >
                                            <Icone nome="fechar" tamanho={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <Botao type="button" variante="secundario" className="botao--pequeno" onClick={adicionarAtributo}>
                            <Icone nome="mais" tamanho={16} /> Adicionar detalhe
                        </Botao>
                    </fieldset>

                    {feedback && (
                        <Mensagem tipo={feedback.tipo} onFechar={() => setFeedback(null)}>
                            {feedback.texto}
                        </Mensagem>
                    )}

                    <div className="form__acoes">
                        <Botao type="submit" carregando={enviando}>
                            {!enviando && <Icone nome="check" tamanho={18} />}
                            {modoEdicao ? 'Salvar alterações' : 'Colocar na arara'}
                        </Botao>
                        <Link className="link-botao link-botao--secundario" to={voltarPara}>
                            Cancelar
                        </Link>
                    </div>
                </form>

                {/* Pré-visualização do card na vitrine */}
                <aside className="previa" aria-label="Pré-visualização na vitrine">
                    <p className="previa__rotulo">
                        <Icone nome="olho" tamanho={16} /> Como vai aparecer na vitrine
                    </p>
                    <div className="card-peca card-peca--previa">
                        <div className="card-peca__midia">
                            <ImagemProduto
                                src={imagemUrl.trim()}
                                alt={nome || 'Nova peça'}
                                categoria={categoria}
                                cor={vestuario.cor}
                            />
                            <span className="card-peca__selos">
                                <SeloEstado estado={vestuario.estado} />
                            </span>
                        </div>
                        <div className="card-peca__corpo">
                            <p className="card-peca__marca">{vestuario.marca || categoria || 'Garimpo'}</p>
                            <h2 className="card-peca__nome">{nome || 'Nome da peça'}</h2>
                            <p className="card-peca__meta">
                                {vestuario.tamanho && <span className="chip-tamanho">{vestuario.tamanho}</span>}
                                <span className="card-peca__disponibilidade">
                                    {textoDisponibilidade(Number.isFinite(estoquePrevia) ? estoquePrevia : 0)}
                                </span>
                            </p>
                        </div>
                        <div className="card-peca__rodape">
                            <Etiqueta preco={precoCentavosPrevia ?? 0} precoOriginal={precoOriginalPrevia} />
                        </div>
                    </div>
                </aside>
            </div>
        </section>
    );
}
