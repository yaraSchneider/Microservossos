// ---------------------------------------------------------------------------
// Tela: página não encontrada (rota "*")
//
// Mantém o nome histórico "EmBreve"; hoje serve como o 404 do brechó.
// ---------------------------------------------------------------------------

import { Link } from 'react-router-dom';
import IlustracaoPeca from '../components/ui/IlustracaoPeca.jsx';

/**
 * @param {object} props
 * @param {string} props.titulo Título da tela.
 */
export default function EmBreve({ titulo = 'Em breve' }) {
    return (
        <section className="estado-vazio estado-vazio--pagina">
            <IlustracaoPeca categoria="Saias" cor="estampado" />
            <p className="sobretitulo">Erro 404</p>
            <h1>{titulo}</h1>
            <p>Parece que essa página já foi garimpada por outra pessoa.</p>
            <Link className="link-botao" to="/">
                Voltar à vitrine
            </Link>
        </section>
    );
}
