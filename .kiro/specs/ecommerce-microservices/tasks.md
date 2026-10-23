# Plano de Implementação: E-commerce com Microsserviços

## Visão Geral

Este plano converte o design em uma série de passos de implementação incrementais para uma aplicação de e-commerce com arquitetura de microsserviços (Node.js + Express nos backends, React + Vite no Frontend, persistência em arquivos `.json`, orquestração com Docker Compose).

A implementação segue as Etapas descritas nos requisitos: primeiro a base de persistência compartilhada, depois cada serviço de backend de forma validável e independente (Produtos → Carrinho → Pedidos), em seguida o cliente HTTP resiliente, o Frontend, a dockerização e, por fim, os testes de integração/smoke. Cada passo constrói sobre o anterior e termina conectado ao restante, sem código órfão.

Os testes baseados em propriedades (PBT) usam **fast-check** integrado ao runner (Vitest), com `numRuns: 100` e uma tag de comentário referenciando a propriedade de design. Cada uma das 10 propriedades da seção Correctness Properties tem uma subtarefa de teste dedicada.

> Subtarefas marcadas com `*` são opcionais (testes) e podem ser puladas para um MVP mais rápido. Tarefas de nível superior e de implementação principal nunca são opcionais.

## Tarefas

- [x] 1. Estrutura base do projeto e utilitário de persistência compartilhado
  - [x] 1.1 Criar a estrutura de pastas dos quatro serviços e configuração base
    - Criar `servico-produtos/`, `servico-carrinho/`, `servico-pedidos/` e `frontend/` na raiz do projeto
    - Em cada backend, criar `package.json` com Express e dependências, script de start e configuração do runner de testes (Vitest) com fast-check
    - Reaproveitar/renomear o ponto de partida `microsservico-produtos/` como base do `servico-produtos`
    - _Requisitos: 12.1, 12.2_

  - [x] 1.2 Implementar o módulo de persistência compartilhado `store.js`
    - Implementar auto-criação do arquivo com estado inicial `[]` quando ausente na inicialização
    - Implementar leitura do conteúdo em memória no start (arquivo vazio assume `[]`)
    - Implementar gravação atômica serializada: fila sequencial de gravação (uma por vez), escrita em arquivo temporário `arquivo.json.tmp` seguida de `rename` atômico sobre o arquivo final
    - Garantir acesso exclusivo ao próprio arquivo do serviço (sem acesso cruzado)
    - Replicar o módulo em cada serviço de backend
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x]* 1.3 Escrever teste de propriedade para gravação atômica
    - **Propriedade 10: Gravação atômica preserva JSON íntegro**
    - **Validates: Requisitos 9.2**
    - Para qualquer sequência de gravações, o arquivo lido após uma gravação concluída é sempre JSON válido e parseável, refletindo estado consistente
    - fast-check com `numRuns: 100` e comentário de tag da propriedade

- [x] 2. Serviço_Produtos (porta 3001)
  - [x] 2.1 Implementar modelo de Produto e validação
    - Definir estrutura do Produto (id único, nome, descrição, categoria, preço em centavos, estoque, imagemUrl opcional, atributos dinâmicos chave-valor)
    - Implementar função de validação: nome não vazio, preço inteiro ≥ 0, estoque inteiro ≥ 0, rejeitando com erro `400 { "erro": ... }`
    - Armazenar atributos personalizados como mapa de pares chave-valor
    - _Requisitos: 1.1, 1.2, 1.8, 1.9_

  - [x]* 2.2 Escrever teste de propriedade para preço em centavos
    - **Propriedade 1: Preço sempre em centavos (inteiro não negativo)**
    - **Validates: Requisitos 1.2, 1.9**
    - Para qualquer produto criado/editado com dados válidos, `preco` armazenado é inteiro ≥ 0
    - fast-check com `numRuns: 100` e comentário de tag da propriedade

  - [x] 2.3 Implementar endpoints CRUD do catálogo com persistência em `produtos.json`
    - `GET /produtos` (lista), `POST /produtos` (cria com id único, 201/400), `GET /produtos/:id` (200/404), `PUT /produtos/:id` (atualiza, 200/400/404), `DELETE /produtos/:id` (remove, 204/404)
    - Persistir cada alteração via `store.js`
    - _Requisitos: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x]* 2.4 Escrever testes unitários para o CRUD de produtos
    - Casos de criar/listar/obter/editar/excluir e 404 para id inexistente
    - Casos de validação (nome vazio, preço não numérico, estoque negativo)
    - _Requisitos: 1.3, 1.4, 1.5, 1.6, 1.7, 1.9_

  - [x] 2.5 Implementar endpoints internos de estoque
    - `GET /produtos/:id/estoque` (consulta disponível, 200/404)
    - `POST /produtos/:id/reservar` (`{ quantidade }`): reduz apenas se `estoque >= quantidade`, senão `409 { "erro": "Estoque insuficiente" }` sem alterar; persistir
    - `POST /produtos/:id/devolver` (`{ quantidade }`): aumenta o estoque e persiste
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

  - [x]* 2.6 Escrever teste de propriedade para controle de estoque na reserva
    - **Propriedade 3: Estoque nunca negativo e reserva limitada ao disponível**
    - **Validates: Requisitos 2.2, 2.3**
    - Reserva acima do disponível é recusada e estoque inalterado; caso contrário reduz exatamente e nunca fica negativo
    - fast-check com `numRuns: 100` e comentário de tag da propriedade

  - [x]* 2.7 Escrever teste de propriedade para round-trip reservar/devolver
    - **Propriedade 4: Round-trip de reserva e devolução preserva o estoque**
    - **Validates: Requisitos 2.2, 2.4**
    - Reservar uma quantidade reservável e depois devolvê-la resulta no estoque original
    - fast-check com `numRuns: 100` e comentário de tag da propriedade

  - [x] 2.8 Adicionar endpoint `GET /health` e inicializar o servidor na porta 3001
    - Retornar `200 { "status": "ok" }`
    - Carregar `produtos.json` no start (criando se ausente) e escutar na porta configurável
    - _Requisitos: 9.1, 12.1, 12.7_

- [x] 3. Checkpoint - Serviço_Produtos funcional
  - Garantir que todos os testes passem; perguntar ao usuário se surgirem dúvidas.

- [x] 4. Serviço_Carrinho (porta 3002)
  - [x] 4.1 Implementar modelo de Carrinho/Item_Carrinho e CRUD básico do carrinho
    - Definir estrutura (id único, itens com produtoId/quantidade/precoUnitario, cep, frete, subtotal, total)
    - `POST /carrinho` (cria vazio, 201), `GET /carrinho/:id` (200/404)
    - Persistir em `carrinhos.json` via `store.js`
    - _Requisitos: 3.1, 3.9, 9.1, 9.2_

  - [x] 4.2 Implementar cálculo de subtotal e total
    - `subtotal` = soma de `precoUnitario * quantidade` de cada item
    - `total` = `subtotal + frete`, com `frete = 0` quando não calculado
    - Recalcular e retornar em `GET /carrinho/:id`
    - _Requisitos: 5.1, 5.2, 5.3_

  - [x]* 4.3 Escrever teste de propriedade para subtotal e total
    - **Propriedade 2: Subtotal e total consistentes**
    - **Validates: Requisitos 5.1, 5.2, 5.3**
    - Para qualquer carrinho, `subtotal` = soma de `precoUnitario * quantidade` e `total` = `subtotal + frete` (frete 0 quando ausente)
    - fast-check com `numRuns: 100` e comentário de tag da propriedade

  - [x] 4.4 Implementar gestão de itens com integração REST ao Serviço_Produtos
    - `POST /carrinho/:id/itens` (`{ produtoId, quantidade }`): consulta `GET /produtos/:id` e `GET /produtos/:id/estoque`; recusa com `409 { "erro": "Estoque insuficiente" }` se exceder o estoque; grava sempre o `precoUnitario` obtido do catálogo, ignorando preço do Frontend
    - `PUT /carrinho/:id/itens/:produtoId` (altera quantidade, 200/404/409), `DELETE /carrinho/:id/itens/:produtoId` (remove, 200/404), `DELETE /carrinho/:id/itens` (limpa todos, 200/404)
    - Persistir cada alteração
    - _Requisitos: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x]* 4.5 Escrever teste de propriedade para preço unitário do catálogo
    - **Propriedade 7: Preço unitário sempre obtido do catálogo**
    - **Validates: Requisitos 3.4**
    - O `precoUnitario` gravado é igual ao preço do produto no Serviço_Produtos, independente do preço no corpo da requisição (usar mock do cliente HTTP)
    - fast-check com `numRuns: 100` e comentário de tag da propriedade

  - [x] 4.6 Implementar cálculo de frete por CEP
    - `POST /carrinho/:id/frete` (`{ cep }`): normalizar removendo hífen/espaços; exigir exatamente 8 dígitos, senão `400 { "erro": "CEP inválido" }`
    - Frete base pelo primeiro dígito: `0–3 → 1500`, `4–6 → 2500`, `7–9 → 3500` centavos; se `subtotal > 50000`, frete `0` (sobrepõe o CEP)
    - Persistir cep/frete no carrinho
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x]* 4.7 Escrever teste de propriedade para cálculo determinístico de frete
    - **Propriedade 5: Cálculo de frete determinístico por CEP e subtotal**
    - **Validates: Requisitos 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**
    - Para CEP válido e qualquer subtotal, frete segue as faixas e a regra de frete grátis; hífen não altera o resultado
    - fast-check com `numRuns: 100` e comentário de tag da propriedade

  - [x]* 4.8 Escrever teste de propriedade para validação de CEP
    - **Propriedade 6: Validação de CEP exige exatamente 8 dígitos**
    - **Validates: Requisitos 4.6, 4.7**
    - Qualquer CEP que, após remover hífen/espaços, não tenha exatamente 8 dígitos é recusado com erro de validação
    - fast-check com `numRuns: 100` e comentário de tag da propriedade

  - [x] 4.9 Adicionar endpoint `GET /health` e inicializar o servidor na porta 3002
    - Retornar `200 { "status": "ok" }`; usar `PRODUTOS_URL` para as chamadas ao catálogo
    - _Requisitos: 12.1, 12.5, 12.7_

- [x] 5. Checkpoint - Serviço_Carrinho funcional
  - Garantir que todos os testes passem; perguntar ao usuário se surgirem dúvidas.

- [x] 6. Serviço_Pedidos (porta 3003)
  - [x] 6.1 Implementar modelo de Pedido e consulta/listagem
    - Definir estrutura (id único, carrinhoId, chaveIdempotencia, comprador, itens snapshot, subtotal, frete, total, status, data)
    - `GET /pedidos` (lista com id/data/total/status), `GET /pedidos/:id` (completo com snapshot, 200/404)
    - Persistir em `pedidos.json` via `store.js`
    - _Requisitos: 8.1, 8.2, 8.3, 9.1, 9.2_

  - [x] 6.2 Implementar fluxo de criação de pedido com snapshot imutável
    - `POST /pedidos` (`{ carrinhoId, comprador: { nome, cep, endereco, numero, complemento? } }`)
    - Consultar `GET /carrinho/:carrinhoId`; revalidar cada item no Serviço_Produtos (existência, preço, estoque)
    - Se qualquer item tiver estoque insuficiente, recusar com `409 { "erro": "Estoque insuficiente" }` sem reservar nada
    - Reservar cada produto via `POST /produtos/:id/reservar`; criar Pedido com snapshot imutável de itens/valores, status `PENDENTE` e dados do comprador (incluindo complemento opcional)
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_

  - [x] 6.3 Implementar idempotência da finalização
    - Derivar chave de idempotência do `carrinhoId` (ou `Idempotency-Key` do Frontend)
    - Se já existir pedido ativo do mesmo carrinho (não recusado/cancelado), retornar o pedido existente (`200`) sem criar duplicado nem reservar estoque novamente
    - _Requisitos: 6.5_

  - [x]* 6.4 Escrever teste de propriedade para snapshot imutável
    - **Propriedade 8: Snapshot do pedido imutável**
    - **Validates: Requisitos 6.4, 6.7, 7.7**
    - Alterações posteriores de preço/atributos no catálogo não modificam o snapshot do pedido (usar mock do cliente HTTP)
    - fast-check com `numRuns: 100` e comentário de tag da propriedade

  - [x]* 6.5 Escrever teste de propriedade para idempotência
    - **Propriedade 9: Idempotência da finalização de compra**
    - **Validates: Requisitos 6.5**
    - Múltiplas tentativas com a mesma chave criam apenas um pedido e reservam estoque uma única vez (usar mock do cliente HTTP)
    - fast-check com `numRuns: 100` e comentário de tag da propriedade

  - [x] 6.6 Implementar pagamento simulado e gestão de status
    - `POST /pedidos/:id/pagamento` (`{ aprovado }`)
    - `aprovado = true` → status `PAGO` + `DELETE /carrinho/:id/itens` (limpa carrinho)
    - `aprovado = false` → status `PAGAMENTO_RECUSADO` + `POST /produtos/:id/devolver` para cada item (devolve estoque)
    - Restringir status a `PENDENTE | PAGO | PAGAMENTO_RECUSADO | CANCELADO`; persistir
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7_

  - [x]* 6.7 Escrever testes unitários para pagamento e consulta de pedidos
    - Aprovado → PAGO + carrinho limpo; recusado → PAGAMENTO_RECUSADO + estoque devolvido
    - Lista/detalhe/404 de pedidos
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3_

  - [x] 6.8 Adicionar endpoint `GET /health` e inicializar o servidor na porta 3003
    - Retornar `200 { "status": "ok" }`; usar `PRODUTOS_URL` e `CARRINHO_URL`
    - _Requisitos: 12.1, 12.5, 12.7_

- [x] 7. Checkpoint - Serviço_Pedidos funcional
  - Garantir que todos os testes passem; perguntar ao usuário se surgirem dúvidas.

- [x] 8. Cliente HTTP compartilhado com resiliência
  - [x] 8.1 Implementar cliente HTTP com retry/backoff e erro amigável 503
    - Módulo de cliente REST entre serviços com retry (ex.: 3 tentativas, backoff curto) para erros de conexão (`ECONNREFUSED`, timeout)
    - Esgotadas as tentativas, retornar erro amigável `503 { "erro": "Serviço X temporariamente indisponível. Tente novamente." }` sem derrubar o processo
    - Integrar o cliente nas chamadas entre serviços de Carrinho e Pedidos (substituindo chamadas diretas)
    - _Requisitos: 10.1, 10.3, 10.4, 12.6_

  - [x]* 8.2 Escrever testes de integração para indisponibilidade e retry
    - Serviço dependente desligado → requisitante retorna `503` amigável; retry durante inicialização
    - _Requisitos: 10.3, 12.6_

- [x] 9. Frontend (React + Vite, porta 3000)
  - [x] 9.1 Configurar projeto React + Vite, proxy e serviço de API
    - Configurar `server.proxy` do Vite mapeando `/api/produtos` → produtos, `/api/carrinho` → carrinho, `/api/pedidos` → pedidos (usando variáveis de ambiente)
    - Criar serviço de API que chama sempre caminhos relativos `/api/...`
    - Implementar utilitário de formatação monetária (centavos → `R$ x.xxx,xx`) e gerenciamento do `carrinhoId` em `localStorage` (criar carrinho se ausente)
    - _Requisitos: 10.2, 5.4, 11.9_

  - [x] 9.2 Implementar tela de catálogo e tela de detalhes do produto
    - Catálogo em cards (imagem, nome, preço, categoria, disponibilidade) com "ver detalhes" e "adicionar ao carrinho"
    - Detalhes com todas as informações + atributos dinâmicos, seleção de quantidade e adicionar ao carrinho
    - _Requisitos: 11.1, 11.4_

  - [x] 9.3 Implementar tela de cadastro/edição de produtos com atributos dinâmicos
    - Formulário com nome, descrição, categoria, preço, estoque, imagem e atributos personalizados (adicionar par nome/valor + pré-visualização)
    - Ações de editar e excluir produtos existentes
    - _Requisitos: 11.2, 11.3_

  - [x] 9.4 Implementar tela de carrinho
    - Itens, quantidade, preço unitário, subtotal, campo de CEP + calcular frete, frete, total, remover itens, alterar quantidades e finalizar compra
    - _Requisitos: 11.5_

  - [x] 9.5 Implementar tela de checkout com pagamento simulado
    - Resumo final + campos nome, CEP, endereço, número, complemento opcional; botões "simular pagamento aprovado/recusado" com mensagem de resultado
    - _Requisitos: 11.6, 7.6_

  - [x] 9.6 Implementar tela de pedidos
    - Lista com id, data, produtos, quantidades, total e status; abrir detalhes completos
    - _Requisitos: 11.7_

  - [x] 9.7 Implementar estados de UI, layout responsivo e CSS moderno
    - Loading em operações dependentes de backend com mensagem final de sucesso/erro
    - Layout responsivo e valores monetários formatados em reais em todas as telas
    - _Requisitos: 11.8, 11.9_

  - [x]* 9.8 Escrever testes de componente do Frontend
    - Telas e estados de loading/sucesso/erro; formatação monetária em reais
    - _Requisitos: 11.8, 11.9_

- [x] 10. Checkpoint - Frontend integrado aos backends
  - Garantir que todos os testes passem; perguntar ao usuário se surgirem dúvidas.

- [x] 11. Dockerização e orquestração
  - [x] 11.1 Criar Dockerfile para cada serviço
    - Dockerfile próprio para `servico-produtos`, `servico-carrinho`, `servico-pedidos` e `frontend` (build Vite + reverse proxy nginx com as mesmas regras de encaminhamento `/api/...`)
    - _Requisitos: 12.2, 10.2_

  - [x] 11.2 Criar `docker-compose.yml` orquestrando os quatro serviços
    - Definir Frontend (3000), Produtos (3001), Carrinho (3002), Pedidos (3003) numa rede bridge com resolução por nome de serviço
    - Configurar volumes bind-mount para os arquivos JSON no diretório do projeto
    - Injetar variáveis de ambiente (`PRODUTOS_URL`, `CARRINHO_URL`, `PEDIDOS_URL`), `restart` e `healthcheck` usando `GET /health`
    - _Requisitos: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 10.1, 10.4_

- [x] 12. Documentação (README)
  - [x] 12.1 Escrever README com instruções de execução e documentação das APIs
    - Comando `docker compose up --build`, URL do Frontend (`http://localhost:3000`) e das APIs
    - Documentar endpoints de cada serviço e os comandos `curl` do fluxo ponta a ponta (produto → carrinho → frete → pedido → pagamento → consulta)
    - Documentar o teste de indisponibilidade (parar um serviço) e o teste de reinício/persistência
    - _Requisitos: 12.3_

- [x] 13. Testes de integração/smoke do fluxo completo e verificação final
  - [x]* 13.1 Escrever testes de integração/smoke de comunicação entre serviços
    - Carrinho consultando produtos; pedidos revalidando/reservando/devolvendo; chamada via proxy do Frontend
    - Persistência: arquivo criado se ausente e dados sobrevivendo a reinício; `GET /health` de cada backend retorna `200`
    - _Requisitos: 10.1, 10.2, 10.4, 9.1, 9.3, 12.7_

  - [x] 13.2 Verificação final de integração entre todos os componentes
    - Garantir que todos os serviços sobem juntos, a comunicação REST funciona e todos os testes passam
    - Confirmar que não há código órfão e que todas as telas consomem os backends via proxy
    - _Requisitos: 12.3_

- [x] 14. Checkpoint final - Ensure all tests pass
  - Garantir que todos os testes passem; perguntar ao usuário se surgirem dúvidas.

## Notas

- Subtarefas marcadas com `*` são opcionais (testes) e podem ser puladas para um MVP mais rápido.
- Cada tarefa referencia requisitos específicos para rastreabilidade.
- Os checkpoints garantem validação incremental de cada serviço antes de avançar.
- Cada uma das 10 Correctness Properties do design tem uma subtarefa de teste de propriedade dedicada (Propriedades 1–10), implementada com fast-check (`numRuns: 100`).
- Propriedades que envolvem chamadas entre serviços (7, 8, 9) usam mocks do cliente HTTP para isolar a lógica.
