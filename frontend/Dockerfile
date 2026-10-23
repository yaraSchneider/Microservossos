# ---------------------------------------------------------------------------
# Dockerfile do Frontend (React + Vite) — build multi-stage.
#
# Stage 1 (build): compila o app com Vite, gerando os estáticos em /app/dist.
# Stage 2 (serve): nginx:alpine servindo os estáticos + reverse proxy /api/...
#                  com as MESMAS regras do proxy de dev do Vite (nginx.conf).
# ---------------------------------------------------------------------------

# --- Stage 1: build dos estáticos --------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Instala TODAS as dependências (incluindo dev) necessárias para o build Vite.
# Copiamos primeiro os manifestos para aproveitar o cache de camadas.
COPY package.json package-lock.json ./
RUN npm ci

# Copia o restante do código-fonte e gera o build de produção em /app/dist.
COPY . .
RUN npm run build

# --- Stage 2: servir com nginx (reverse proxy) -------------------------------
FROM nginx:alpine

# Configuração do reverse proxy (SPA + encaminhamento /api/... aos backends).
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY proxy_headers.conf /etc/nginx/proxy_headers.conf

# Copia os estáticos gerados no stage de build para o diretório servido.
COPY --from=build /app/dist /usr/share/nginx/html

# Porta do Frontend (consistente com o design e o docker-compose).
EXPOSE 3000

# CMD padrão da imagem nginx (nginx -g 'daemon off;'); mantido explícito.
CMD ["nginx", "-g", "daemon off;"]
