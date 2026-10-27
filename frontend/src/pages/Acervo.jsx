// ---------------------------------------------------------------------------
// Tela: Acervo (rota "/acervo")
//
// Bastidores do brechó: o CRUD completo das peças num só lugar. Mostra os
// números do acervo (cadastradas, na arara, vendidas e valor em estoque), busca
// e filtros, e uma tabela com ações de ver, editar e excluir cada peça. A
// exclusão passa por um diálogo de confirmação e atualiza a lista sem
// recarregar. Toda operação dependente de backend exibe loading e mensagem
// final de sucesso/erro. (Requisitos 11.1–11.4, 11.8, 11.9)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { produtos as apiProdutos } from '../services/api.js';
import { formatarReais } from '../utils/formato.js';
import { lerPeca } from '../utils/peca.js';
import Loading from '../components/ui/Loading.jsx';
import Mensagem from '../components/ui/Mensagem.jsx';
import Botao from '../components/ui/Botao.jsx';
import Icone from '../components/ui/Icone.jsx';
import ImagemProduto from '../components/ui/ImagemProduto.jsx';
import SeloEstado from '../components/ui/SeloEstado.jsx';
import ConfirmarDialogo from '../components/ui/ConfirmarDialogo.jsx';

const FILTROS_STATUS = {
    todas: 'Todas',
    arara: 'Na arara',
    vendidas: 'Vendidas',
};

export default function Acervo() {
    // Aviso vindo de outra tela (ex.: exclusão feita nos detalhes da peça).
    const { state } = useLocation();

    const [lista, setLista] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [feedback, setFeedback] = useState(() =>
        state?.aviso ? { tipo: 'sucesso', texto: state.aviso } : null
    );

    const [busca, setBusca] = useState('');
    const [status, setStatus] = useState('todas');
    const [categoria, setCategoria] = useState('');

    // Peça aguardando confirmação de exclusão.
    const [paraExcluir, setParaExcluir] = useState(null);
    const [excluindo, setExcluindo] = useState(false);

    const carregar = useCallback(async () => {
        setCarregando(true);
        setErro('');
        try {
            const dados = await apiProdutos.listar();
            setLista(Array.isArray(dados) ? dados : []);
        } catch (e) {
            setErro(e.message || 'Não foi possível carregar o acervo.');
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    const numeros = useMemo(() => {
        const naArara = lista.filter((p) => Number(p.estoque) > 0);
        return {
            total: lista.length,
            naArara: naArara.length,
            vendidas: lista.length - naArara.length,
            valorArara: naArara.reduce(
                (soma, p) => soma + (Number(p.preco) || 0) * (Number(p.estoque) || 0),
                0
            ),
        };
    }, [lista]);

    const categorias = useMemo(
        () => [...new Set(lista.map((p) => p.categoria).filter(Boolean))].sort(),
        [lista]
    );

    const linhas = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        return lista
            .map((produto) => ({ produto, peca: lerPeca(produto) }))
            .filter(({ produto, peca }) => {
                const estoque = Number(produto.estoque) || 0;
                if (status === 'arara' && estoque <= 0) return false;
                if (status === 'vendidas' && estoque > 0) return false;
                if (categoria && produto.categoria !== categoria) return false;
                if (termo) {
                    const alvo = `${produto.nome} ${peca.marca} ${produto.id}`.toLowerCase();
                    if (!alvo.includes(termo)) return false;
                }
                return true;
            })
            .reverse(); // mais recentes primeiro
    }, [lista, busca, status, categoria]);

    async function confirmarExclusao() {
        if (!paraExcluir) {
            return;
        }
        setExcluindo(true);
        try {
            await apiProdutos.remover(paraExcluir.id);
            setLista((atual) => atual.filter((p) => p.id !== paraExcluir.id));
            setFeedback({ tipo: 'sucesso', texto: `"${paraExcluir.nome}" foi removida do acervo.` });
        } catch (e) {
            setFeedback({ tipo: 'erro', texto: e.message || 'Não foi possível excluir a peça.' });
        } finally {
            setExcluindo(false);
            setParaExcluir(null);
        }
    }

    if (carregando) {
        return <Loading texto="Carregando o acervo..." />;
    }

    if (erro) {
        return (
            <section className="acervo">
                <div className="pagina-cabecalho">
                    <h1>Acervo</h1>
                </div>
                <Mensagem tipo="erro">{erro}</Mensagem>
                <Botao variante="secundario" onClick={carregar}>
                    Tentar novamente
                </Botao>
            </section>
        );
    }

    return (
        <section className="acervo">
            <div className="pagina-cabecalho">
                <div>
                    <p className="sobretitulo">Bastidores</p>
                    <h1>Acervo</h1>
                    <p className="pagina-cabecalho__descricao">
                        Cadastre, edite e tire peças da arara. Tudo o que muda aqui aparece na
                        vitrine na hora.
                    </p>
                </div>
                <Link className="link-botao" to="/produtos/novo">
                    <Icone nome="mais" tamanho={18} /> Nova peça
                </Link>
            </div>

            <dl className="numeros">
                <div className="numero">
                    <dt>
                        <Icone nome="cabide" tamanho={18} /> Peças cadastradas
                    </dt>
                    <dd>{numeros.total}</dd>
                </div>
                <div className="numero">
                    <dt>
                        <Icone nome="grade" tamanho={18} /> Na arara
                    </dt>
                    <dd>{numeros.naArara}</dd>
                </div>
                <div className="numero">
                    <dt>
                        <Icone nome="check" tamanho={18} /> Vendidas
                    </dt>
                    <dd>{numeros.vendidas}</dd>
                </div>
                <div className="numero numero--destaque">
                    <dt>
                        <Icone nome="etiqueta" tamanho={18} /> Valor na arara
                    </dt>
                    <dd>{formatarReais(numeros.valorArara)}</dd>
                </div>
            </dl>

            {feedback && (
                <Mensagem tipo={feedback.tipo} onFechar={() => setFeedback(null)}>
                    {feedback.texto}
                </Mensagem>
            )}

            {lista.length === 0 ? (
                <div className="estado-vazio">
                    <h3>O acervo está vazio</h3>
                    <p>Cadastre a primeira peça para ela aparecer na vitrine.</p>
                    <Link className="link-botao" to="/produtos/novo">
                        <Icone nome="mais" tamanho={18} /> Cadastrar peça
                    </Link>
                </div>
            ) : (
                <div className="painel">
                    <div className="painel__barra">
                        <label className="campo-busca">
                            <Icone nome="busca" tamanho={18} />
                            <span className="sr-only">Buscar no acervo</span>
                            <input
                                type="search"
                                placeholder="Nome, marca ou código"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                            />
                        </label>

                        <div className="segmentado" role="group" aria-label="Filtrar por situação">
                            {Object.entries(FILTROS_STATUS).map(([chave, rotulo]) => (
                                <button
                                    type="button"
                                    key={chave}
                                    aria-pressed={status === chave}
                                    className={status === chave ? 'segmentado__opcao--ativa' : ''}
                                    onClick={() => setStatus(chave)}
                                >
                                    {rotulo}
                                </button>
                            ))}
                        </div>

                        {categorias.length > 1 && (
                            <label className="filtro-select">
                                <span className="sr-only">Categoria</span>
                                <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                                    <option value="">Todas as categorias</option>
                                    {categorias.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>

                    {linhas.length === 0 ? (
                        <p className="painel__vazio">Nenhuma peça encontrada com esses filtros.</p>
                    ) : (
                        <table className="tabela-acervo">
                            <thead>
                                <tr>
                                    <th scope="col">Peça</th>
                                    <th scope="col">Categoria</th>
                                    <th scope="col">Tam.</th>
                                    <th scope="col">Estado</th>
                                    <th scope="col" className="tabela-acervo__numero">
                                        Preço
                                    </th>
                                    <th scope="col" className="tabela-acervo__numero">
                                        Estoque
                                    </th>
                                    <th scope="col">
                                        <span className="sr-only">Ações</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {linhas.map(({ produto, peca }) => {
                                    const estoque = Number(produto.estoque) || 0;
                                    return (
                                        <tr key={produto.id} className={estoque <= 0 ? 'tabela-acervo__linha--vendida' : ''}>
                                            <td data-rotulo="Peça">
                                                <div className="tabela-acervo__peca">
                                                    <span className="tabela-acervo__miniatura">
                                                        <ImagemProduto
                                                            src={produto.imagemUrl}
                                                            alt={produto.nome}
                                                            categoria={produto.categoria}
                                                            cor={peca.cor}
                                                        />
                                                    </span>
                                                    <span>
                                                        <Link to={`/produto/${produto.id}`} className="tabela-acervo__nome">
                                                            {produto.nome}
                                                        </Link>
                                                        <span className="tabela-acervo__sub">
                                                            {peca.marca ? `${peca.marca} · ` : ''}
                                                            <code>{produto.id}</code>
                                                        </span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td data-rotulo="Categoria">{produto.categoria || '—'}</td>
                                            <td data-rotulo="Tamanho">
                                                {peca.tamanho ? <span className="chip-tamanho">{peca.tamanho}</span> : '—'}
                                            </td>
                                            <td data-rotulo="Estado">
                                                {peca.estado ? <SeloEstado estado={peca.estado} /> : '—'}
                                            </td>
                                            <td data-rotulo="Preço" className="tabela-acervo__numero">
                                                <strong>{formatarReais(produto.preco)}</strong>
                                            </td>
                                            <td data-rotulo="Estoque" className="tabela-acervo__numero">
                                                {estoque > 0 ? (
                                                    estoque
                                                ) : (
                                                    <span className="disponibilidade disponibilidade--esgotado">Vendida</span>
                                                )}
                                            </td>
                                            <td className="tabela-acervo__acoes">
                                                <Link
                                                    className="botao-icone"
                                                    to={`/produto/${produto.id}`}
                                                    title="Ver na vitrine"
                                                    aria-label={`Ver ${produto.nome}`}
                                                >
                                                    <Icone nome="olho" tamanho={18} />
                                                </Link>
                                                <Link
                                                    className="botao-icone"
                                                    to={`/produtos/${produto.id}/editar`}
                                                    title="Editar"
                                                    aria-label={`Editar ${produto.nome}`}
                                                >
                                                    <Icone nome="lapis" tamanho={18} />
                                                </Link>
                                                <button
                                                    type="button"
                                                    className="botao-icone botao-icone--perigo"
                                                    onClick={() => setParaExcluir(produto)}
                                                    title="Excluir"
                                                    aria-label={`Excluir ${produto.nome}`}
                                                >
                                                    <Icone nome="lixeira" tamanho={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            <ConfirmarDialogo
                aberto={Boolean(paraExcluir)}
                titulo="Excluir esta peça?"
                rotuloConfirmar="Excluir peça"
                carregando={excluindo}
                onConfirmar={confirmarExclusao}
                onCancelar={() => setParaExcluir(null)}
            >
                <p>
                    <strong>{paraExcluir?.nome}</strong> sairá da vitrine e do acervo. Essa ação
                    não pode ser desfeita.
                </p>
            </ConfirmarDialogo>
        </section>
    );
}
