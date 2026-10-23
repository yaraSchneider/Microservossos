# Dockerfile do Serviço_Produtos (catálogo + estoque, porta 3001)
# Imagem Node LTS enxuta (alpine) para runtime de produção.
FROM node:20-alpine

WORKDIR /app

# Instala apenas as dependências de runtime (express). As devDependencies
# (vitest/fast-check/supertest) não são necessárias no contêiner.
# Copiamos primeiro os manifestos para aproveitar o cache de camadas do Docker.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copia o código-fonte do serviço. O .dockerignore exclui node_modules,
# testes e os .json locais de dados (que são montados via bind-mount no compose).
COPY . .

# Garante que o diretório de dados exista mesmo antes do bind-mount do compose,
# para que o store.js possa criar/ler o produtos.json na inicialização.
RUN mkdir -p data

# A porta é configurável via env PORT (default 3001 em server.js).
EXPOSE 3001

CMD ["node", "server.js"]
