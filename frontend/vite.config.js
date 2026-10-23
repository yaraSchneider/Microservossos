/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ---------------------------------------------------------------------------
// Configuração do Vite (Frontend, porta 3000)
//
// Proxy de desenvolvimento/produção: o navegador SEMPRE chama caminhos
// relativos `/api/...` e nunca conhece os nomes internos dos contêineres.
// O proxy encaminha cada prefixo ao backend correspondente, evitando CORS e
// ocultando os nomes internos de serviço na Rede Docker. (Requisito 10.2)
//
// Os endereços de destino vêm de variáveis de ambiente injetadas pelo
// docker-compose (Requisito 12.5); se ausentes, usam os nomes de serviço
// padrão da Rede Docker.
//
// Convenção de caminhos (rewrite remove o prefixo `/api/<servico>` e o
// substitui pelo prefixo real que cada backend expõe na raiz):
//   /api/produtos  -> PRODUTOS_URL  (rewrite ^/api/produtos -> /produtos)
//   /api/carrinho  -> CARRINHO_URL  (rewrite ^/api/carrinho -> /carrinho)
//   /api/pedidos   -> PEDIDOS_URL   (rewrite ^/api/pedidos  -> /pedidos)
//
// Exemplos:
//   navegador GET  /api/produtos            -> produtos  GET  /produtos
//   navegador GET  /api/produtos/p-1/estoque-> produtos  GET  /produtos/p-1/estoque
//   navegador POST /api/carrinho            -> carrinho  POST /carrinho
//   navegador POST /api/carrinho/c-1/itens  -> carrinho  POST /carrinho/c-1/itens
//   navegador GET  /api/pedidos             -> pedidos   GET  /pedidos
//   navegador POST /api/pedidos/o-1/pagamento-> pedidos  POST /pedidos/o-1/pagamento
// ---------------------------------------------------------------------------

const PRODUTOS_URL = process.env.PRODUTOS_URL || 'http://produtos:3001';
const CARRINHO_URL = process.env.CARRINHO_URL || 'http://carrinho:3002';
const PEDIDOS_URL = process.env.PEDIDOS_URL || 'http://pedidos:3003';

export default defineConfig({
    plugins: [react()],
    server: {
        host: '0.0.0.0', // necessário para funcionar dentro do contêiner Docker
        port: 3000,
        strictPort: true,
        proxy: {
            '/api/produtos': {
                target: PRODUTOS_URL,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/produtos/, '/produtos'),
            },
            '/api/carrinho': {
                target: CARRINHO_URL,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/carrinho/, '/carrinho'),
            },
            '/api/pedidos': {
                target: PEDIDOS_URL,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/pedidos/, '/pedidos'),
            },
        },
    },
    preview: {
        host: '0.0.0.0',
        port: 3000,
        strictPort: true,
    },
    // Ambiente de testes de componente (Vitest + Testing Library).
    // Roda em jsdom e não depende do servidor de dev nem dos backends.
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.js'],
        include: ['src/**/*.test.{js,jsx}'],
    },
});
