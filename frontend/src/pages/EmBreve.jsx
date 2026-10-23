// ---------------------------------------------------------------------------
// Placeholder: "Em breve"
//
// Usado pelas rotas cujas telas são implementadas em tarefas posteriores
// (cadastro/edição 9.3, carrinho 9.4, checkout 9.5, pedidos 9.6). Apenas
// garante que a navegação funcione e o build compile.
// ---------------------------------------------------------------------------

import { Link } from 'react-router-dom';

/**
 * @param {object} props
 * @param {string} props.titulo Título da tela futura.
 */
export default function EmBreve({ titulo = 'Em breve' }) {
    return (
        <section className="card">
            <h1>{titulo}</h1>
            <p>Esta tela será implementada em uma próxima etapa.</p>
            <p>
                <Link to="/">← Voltar ao catálogo</Link>
            </p>
        </section>
    );
}
