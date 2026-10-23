import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.js'],
    // Os testes de HTTP compartilham o mesmo singleton de server.js e o mesmo
    // arquivo data/carrinhos.json. Desativar o paralelismo entre arquivos
    // evita corrida na gravação atômica (rename) sobre o arquivo compartilhado.
    fileParallelism: false,
  },
});
