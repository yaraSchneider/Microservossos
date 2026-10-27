// ---------------------------------------------------------------------------
// Tela: Vitrine (rota "/")
//
// Catálogo público do brechó: destaque da loja, busca por nome/marca, filtros
// por categoria e tamanho, ordenação e a grade de peças (CardPeca). Peças
// vendidas ficam ocultas por padrão. Toda operação dependente de backend exibe
// loading e mensagem final de sucesso/erro. (Requisitos 11.1, 11.8, 11.9)
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { produtos as apiProdutos } from '../services/api.js';
import { CATEGORIAS, TAMANHOS, lerPeca } from '../utils/peca.js';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Icone from '../components/ui/Icone.jsx';
import IlustracaoPeca from '../components/ui/IlustracaoPeca.jsx';
import CardPeca from '../components/peca/CardPeca.jsx';

const ORDENACOES = {
    recentes: { rotulo: 'Recém-chegadas', comparar: (a, b) => b.indice - a.indice },
    'menor-preco': { rotulo: 'Menor preço', comparar: (a, b) => a.produto.preco - b.produto.preco },
    'maior-preco': { rotulo: 'Maior preço', comparar: (a, b) => b.produto.preco - a.produto.preco },
};

/** Normaliza um texto para busca sem acento e sem caixa. */
function normalizar(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
}

export default function Catalogo() {
    const [lista, setLista] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');

    // Feedback da ação "adicionar à sacola" (banner global).
    const [feedback, setFeedback] = useState(null); // { tipo, texto }

    // Filtros da vitrine.
    const [busca, setBusca] = useState('');
    const [categoria, setCategoria] = useState('');
    const [tamanho, setTamanho] = useState('');
    const [ordem, setOrdem] = useState('recentes');
    const [mostrarVendidas, setMostrarVendidas] = useState(false);

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
                    setErro(e.message || 'Não foi possível carregar as peças.');
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

    // Avisos de sucesso somem sozinhos; erros ficam até serem fechados.
    useEffect(() => {
        if (feedback?.tipo !== 'sucesso') {
            return undefined;
        }
        const timer = setTimeout(() => setFeedback(null), 4500);
        return () => clearTimeout(timer);
    }, [feedback]);

    // Categorias e tamanhos que existem de fato no acervo, na ordem canônica
    // (valores livres de cadastros antigos vão para o fim).
    const { categoriasPresentes, tamanhosPresentes } = useMemo(() => {
        const cats = new Set(lista.map((p) => p.categoria).filter(Boolean));
        const tams = new Set(lista.map((p) => lerPeca(p).tamanho).filter(Boolean));
        const ordenar = (conjunto, canonica) => [
            ...canonica.filter((v) => conjunto.has(v)),
            ...[...conjunto].filter((v) => !canonica.includes(v)).sort(),
        ];
        return {
            categoriasPresentes: ordenar(cats, CATEGORIAS),
            tamanhosPresentes: ordenar(tams, TAMANHOS),
        };
    }, [lista]);

    const pecasVisiveis = useMemo(() => {
        const termo = normalizar(busca.trim());
        return lista
            .map((produto, indice) => ({ produto, indice, peca: lerPeca(produto) }))
            .filter(({ produto, peca }) => {
                if (!mostrarVendidas && Number(produto.estoque) <= 0) return false;
                if (categoria && produto.categoria !== categoria) return false;
                if (tamanho && peca.tamanho !== tamanho) return false;
                if (termo) {
                    const alvo = normalizar(`${produto.nome} ${peca.marca} ${produto.categoria}`);
                    if (!alvo.includes(termo)) return false;
                }
                return true;
            })
            .sort(ORDENACOES[ordem].comparar);
    }, [lista, busca, categoria, tamanho, ordem, mostrarVendidas]);

    const disponiveis = lista.filter((p) => Number(p.estoque) > 0).length;
    const filtrando = Boolean(busca || categoria || tamanho);

    function limparFiltros() {
        setBusca('');
        setCategoria('');
        setTamanho('');
    }

    if (carregando) {
        return <Loading texto="Carregando a vitrine..." />;
    }

    if (erro) {
        return (
            <Mensagem tipo="erro">
                {erro} Recarregue a página para tentar novamente.
            </Mensagem>
        );
    }

    return (
        <section className="vitrine">
            <header className="hero">
                <div className="hero__texto">
                    <p className="sobretitulo">Brechó online · curadoria semanal</p>
                    <h1 className="hero__titulo">
                        Peças com história, <em>preços com propósito.</em>
                    </h1>
                    <p className="hero__descricao">
                        Roupas de segunda mão escolhidas uma a uma, revisadas, lavadas e
                        prontas para uma nova vida no seu guarda-roupa.
                    </p>
                    <div className="hero__acoes">
                        <a className="link-botao" href="#pecas">
                            Garimpar agora <Icone nome="seguir" tamanho={18} />
                        </a>
                        <Link className="link-botao link-botao--secundario" to="/produtos/novo">
                            Cadastrar uma peça
                        </Link>
                    </div>
                    <dl className="hero__numeros">
                        <div>
                            <dt>peças na arara</dt>
                            <dd>{disponiveis}</dd>
                        </div>
                        <div>
                            <dt>categorias</dt>
                            <dd>{categoriasPresentes.length}</dd>
                        </div>
                        <div>
                            <dt>peças únicas</dt>
                            <dd>100%</dd>
                        </div>
                    </dl>
                </div>

                <div className="hero__arara" aria-hidden="true">
                    <span className="hero__varao" />
                    <span className="hero__peca hero__peca--1">
                        <IlustracaoPeca categoria="Vestidos" cor="terracota" />
                    </span>
                    <span className="hero__peca hero__peca--2">
                        <IlustracaoPeca categoria="Jaquetas & Casacos" cor="jeans" />
                    </span>
                    <span className="hero__peca hero__peca--3">
                        <IlustracaoPeca categoria="Tricôs" cor="mostarda" />
                    </span>
                    <span className="hero__selo">
                        Achados
                        <br />
                        da semana
                    </span>
                </div>
            </header>

            <div id="pecas" className="vitrine__barra">
                <div className="vitrine__titulo">
                    <h2>A arara</h2>
                    <span className="vitrine__contagem">
                        {pecasVisiveis.length} {pecasVisiveis.length === 1 ? 'peça' : 'peças'}
                    </span>
                </div>

                <div className="filtros">
                    <label className="campo-busca">
                        <Icone nome="busca" tamanho={18} />
                        <span className="sr-only">Buscar peças</span>
                        <input
                            type="search"
                            placeholder="Buscar por peça ou marca"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                        />
                    </label>

                    <label className="filtro-select">
                        <span className="sr-only">Tamanho</span>
                        <select value={tamanho} onChange={(e) => setTamanho(e.target.value)}>
                            <option value="">Todos os tamanhos</option>
                            {tamanhosPresentes.map((t) => (
                                <option key={t} value={t}>
                                    Tamanho {t}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="filtro-select">
                        <span className="sr-only">Ordenar por</span>
                        <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
                            {Object.entries(ORDENACOES).map(([chave, { rotulo }]) => (
                                <option key={chave} value={chave}>
                                    {rotulo}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="alternador">
                        <input
                            type="checkbox"
                            checked={mostrarVendidas}
                            onChange={(e) => setMostrarVendidas(e.target.checked)}
                        />
                        <span>Mostrar vendidas</span>
                    </label>
                </div>

                {categoriasPresentes.length > 0 && (
                    <div className="chips" role="group" aria-label="Filtrar por categoria">
                        <button
                            type="button"
                            className={`chip ${categoria === '' ? 'chip--ativo' : ''}`}
                            aria-pressed={categoria === ''}
                            onClick={() => setCategoria('')}
                        >
                            Tudo
                        </button>
                        {categoriasPresentes.map((c) => (
                            <button
                                type="button"
                                key={c}
                                className={`chip ${categoria === c ? 'chip--ativo' : ''}`}
                                aria-pressed={categoria === c}
                                onClick={() => setCategoria(categoria === c ? '' : c)}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {feedback && (
                <div className="aviso-flutuante">
                    <Mensagem tipo={feedback.tipo} onFechar={() => setFeedback(null)}>
                        {feedback.texto}{' '}
                        {feedback.tipo === 'sucesso' && <Link to="/carrinho">Ver sacola</Link>}
                    </Mensagem>
                </div>
            )}

            {lista.length === 0 ? (
                <div className="estado-vazio">
                    <IlustracaoPeca categoria="Camisetas" cor="bege" />
                    <h3>Nenhuma peça cadastrada ainda</h3>
                    <p>A arara está vazia. Que tal garimpar a primeira peça?</p>
                    <Link className="link-botao" to="/produtos/novo">
                        <Icone nome="mais" tamanho={18} /> Cadastrar a primeira peça
                    </Link>
                </div>
            ) : pecasVisiveis.length === 0 ? (
                <div className="estado-vazio">
                    <IlustracaoPeca categoria="Calças" cor="cinza" />
                    <h3>Nada por aqui com esses filtros</h3>
                    <p>
                        {filtrando
                            ? 'Tente outra combinação: o garimpo é cheio de surpresas.'
                            : 'Todas as peças já foram vendidas. Novidades chegam toda semana!'}
                    </p>
                    {filtrando && (
                        <button type="button" className="botao botao--secundario" onClick={limparFiltros}>
                            <span>Limpar filtros</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="grade-pecas">
                    {pecasVisiveis.map(({ produto }) => (
                        <CardPeca key={produto.id} produto={produto} aoNotificar={setFeedback} />
                    ))}
                </div>
            )}
        </section>
    );
}
