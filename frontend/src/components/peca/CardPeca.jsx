// ---------------------------------------------------------------------------
// CardPeca
//
// Card da vitrine: foto (ou ilustração), selo de estado, marca, nome, tamanho
// e etiqueta de preço, com a ação "adicionar à sacola" e estado de
// carregamento próprio. Peças vendidas recebem o carimbo "Vendida".
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { carrinho as apiCarrinho } from '../../services/api.js';
import { obterOuCriarCarrinhoId } from '../../utils/carrinhoId.js';
import { avisarSacolaAtualizada } from '../../utils/sacolaEventos.js';
import { lerPeca } from '../../utils/peca.js';
import Botao from '../ui/Botao.jsx';
import Etiqueta from '../ui/Etiqueta.jsx';
import ImagemProduto from '../ui/ImagemProduto.jsx';
import SeloEstado from '../ui/SeloEstado.jsx';
import Icone from '../ui/Icone.jsx';
import { textoDisponibilidade } from '../ui/Disponibilidade.jsx';

/**
 * @param {object} props
 * @param {object} props.produto Produto do Serviço_Produtos.
 * @param {(feedback: { tipo: string, texto: string }) => void} props.aoNotificar
 */
export default function CardPeca({ produto, aoNotificar }) {
    const [adicionando, setAdicionando] = useState(false);
    const peca = lerPeca(produto);
    const estoque = Number(produto.estoque) || 0;
    const esgotado = estoque <= 0;
    const link = `/produto/${produto.id}`;

    async function adicionar() {
        setAdicionando(true);
        try {
            const carrinhoId = await obterOuCriarCarrinhoId();
            await apiCarrinho.adicionarItem(carrinhoId, {
                produtoId: produto.id,
                quantidade: 1,
            });
            avisarSacolaAtualizada();
            aoNotificar({
                tipo: 'sucesso',
                texto: `"${produto.nome}" foi para a sacola.`,
            });
        } catch (e) {
            aoNotificar({
                tipo: 'erro',
                texto: e.message || 'Não foi possível adicionar à sacola.',
            });
        } finally {
            setAdicionando(false);
        }
    }

    return (
        <article className={`card-peca ${esgotado ? 'card-peca--vendida' : ''}`.trim()}>
            <Link to={link} className="card-peca__midia" tabIndex={-1} aria-hidden="true">
                <ImagemProduto
                    src={produto.imagemUrl}
                    alt={produto.nome}
                    categoria={produto.categoria}
                    cor={peca.cor}
                />
                <span className="card-peca__selos">
                    <SeloEstado estado={peca.estado} />
                </span>
                {esgotado && <span className="carimbo">Vendida</span>}
            </Link>

            <div className="card-peca__corpo">
                <p className="card-peca__marca">{peca.marca || produto.categoria || 'Garimpo'}</p>
                <h2 className="card-peca__nome">
                    <Link to={link}>{produto.nome}</Link>
                </h2>
                <p className="card-peca__meta">
                    {peca.tamanho && <span className="chip-tamanho">{peca.tamanho}</span>}
                    <span className="card-peca__disponibilidade">{textoDisponibilidade(estoque)}</span>
                </p>
            </div>

            <div className="card-peca__rodape">
                <Etiqueta preco={produto.preco} precoOriginal={peca.precoOriginal} />
                <Botao
                    className="card-peca__acao"
                    onClick={adicionar}
                    carregando={adicionando}
                    disabled={esgotado}
                    aria-label={esgotado ? `${produto.nome} vendida` : `Adicionar ${produto.nome} à sacola`}
                >
                    {!adicionando && <Icone nome={esgotado ? 'check' : 'sacola'} tamanho={18} />}
                    {esgotado ? 'Vendida' : 'Quero'}
                </Botao>
            </div>
        </article>
    );
}
