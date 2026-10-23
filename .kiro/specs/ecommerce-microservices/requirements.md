# Documento de Requisitos

## Introdução

Este documento especifica os requisitos para uma aplicação de e-commerce completa, porém simples, construída com arquitetura de microsserviços. O objetivo técnico principal é demonstrar a comunicação entre diferentes contêineres Docker, cada um responsável por uma parte do processo (catálogo de produtos, carrinho, pedidos e interface). A aplicação deve permitir cadastrar produtos com atributos personalizáveis, montar um carrinho, calcular frete simulado por CEP, finalizar a compra com pagamento simulado e consultar o histórico de pedidos.

A solução utiliza Frontend em React + Vite, Backends em Node.js + Express, comunicação via APIs REST sobre HTTP com JSON, persistência em arquivos `.json`, conteinerização com Docker e orquestração com Docker Compose. Não são utilizados bancos de dados tradicionais, autenticação, serviços de nuvem ou integrações externas. A complexidade deve ser mantida mínima e nenhuma funcionalidade além das descritas deve ser adicionada.

Há um ponto de partida existente na pasta `microsservico-produtos/` (serviço de produtos em memória na porta 3000), que será reestruturado para a arquitetura de quatro serviços descrita neste documento.

## Glossário

- **Sistema**: O conjunto completo da aplicação de e-commerce composto pelos quatro serviços conteinerizados.
- **Serviço_Produtos**: Microsserviço de catálogo responsável por cadastro, consulta e controle de estoque de produtos, executado na porta 3001.
- **Serviço_Carrinho**: Microsserviço responsável por criar carrinhos, gerenciar itens e calcular subtotal, frete e total, executado na porta 3002.
- **Serviço_Pedidos**: Microsserviço responsável por criar pedidos, processar pagamento simulado, gerenciar status e armazenar histórico de compras, executado na porta 3003.
- **Frontend**: Aplicação React + Vite que fornece a interface do e-commerce, executada na porta 3000.
- **Produto**: Item do catálogo contendo identificador único, nome, descrição, categoria, preço em centavos, quantidade em estoque, URL de imagem opcional e atributos personalizados dinâmicos.
- **Atributo_Personalizado**: Par chave-valor dinâmico associado a um produto, adicionado, editado ou removido livremente pelo usuário.
- **Carrinho**: Coleção de itens selecionados pelo usuário, identificada por um identificador único armazenado no navegador.
- **Item_Carrinho**: Registro de um produto dentro de um carrinho, contendo identificador do produto, quantidade e preço unitário obtido do Serviço_Produtos.
- **Pedido**: Registro de uma compra finalizada, contendo identificador único, dados do comprador, snapshot dos itens, valores, status e data.
- **Snapshot**: Cópia imutável dos valores e atributos de um produto no momento da compra, independente de alterações futuras no catálogo.
- **CEP**: Código de Endereçamento Postal brasileiro composto por oito dígitos, aceito com ou sem hífen.
- **Frete**: Valor de entrega simulado calculado a partir do primeiro dígito do CEP e do subtotal do carrinho.
- **Subtotal**: Soma dos preços unitários multiplicados pelas quantidades de todos os itens do carrinho.
- **Total**: Soma do subtotal e do frete do carrinho.
- **Pagamento_Simulado**: Processo de pagamento sem gateways reais nem dados reais de cartão, com resultado aprovado ou recusado selecionado pelo usuário.
- **Rede_Docker**: Rede interna do Docker que permite a comunicação entre contêineres por nome de serviço.
- **Proxy_Frontend**: Configuração de proxy no Frontend que encaminha requisições do navegador aos serviços de backend evitando CORS e nomes internos de contêiner no navegador.
- **Arquivo_JSON**: Arquivo de persistência exclusivo de cada serviço, armazenado em disco via volume Docker com bind mount.
- **Centavos**: Unidade de armazenamento monetário inteira usada para preços e valores, evitando erros de arredondamento.

## Requisitos

### Requisito 1: Cadastro e Gestão de Produtos

**User Story:** Como lojista, quero cadastrar e gerenciar produtos com atributos personalizáveis, para que o catálogo reflita os itens disponíveis para venda.

#### Critérios de Aceitação

1. WHEN o usuário envia um cadastro de produto com nome, descrição, categoria, preço, quantidade em estoque e, opcionalmente, URL de imagem e atributos personalizados, THE Serviço_Produtos SHALL criar o Produto com um identificador único e persistir o registro no Arquivo_JSON de produtos.
2. THE Serviço_Produtos SHALL armazenar o preço de cada Produto em Centavos.
3. WHEN o usuário solicita a lista de produtos, THE Serviço_Produtos SHALL retornar todos os produtos cadastrados.
4. WHEN o usuário solicita um produto por identificador existente, THE Serviço_Produtos SHALL retornar os dados completos do Produto correspondente.
5. IF o usuário solicita um produto por identificador inexistente, THEN THE Serviço_Produtos SHALL retornar um erro com código de status 404 e mensagem descritiva.
6. WHEN o usuário envia uma edição de um produto existente, THE Serviço_Produtos SHALL atualizar os dados do Produto e persistir a alteração no Arquivo_JSON de produtos.
7. WHEN o usuário solicita a exclusão de um produto existente, THE Serviço_Produtos SHALL remover o Produto do Arquivo_JSON de produtos.
8. WHERE um Produto possui atributos personalizados, THE Serviço_Produtos SHALL armazenar cada Atributo_Personalizado como par chave-valor associado ao Produto.
9. IF o usuário envia um cadastro ou edição de produto com nome vazio, preço não numérico ou estoque negativo, THEN THE Serviço_Produtos SHALL rejeitar a operação e retornar um erro de validação com mensagem descritiva.

### Requisito 2: Controle de Estoque e Prevenção de Venda em Excesso

**User Story:** Como lojista, quero que o estoque seja controlado de forma consistente, para que nenhum produto seja vendido além da quantidade disponível.

#### Critérios de Aceitação

1. WHEN o Serviço_Carrinho ou o Serviço_Pedidos consulta a quantidade em estoque de um Produto, THE Serviço_Produtos SHALL retornar a quantidade atual disponível do Produto.
2. WHEN o Serviço_Pedidos solicita a reserva de uma quantidade de um Produto e o estoque disponível é maior ou igual à quantidade solicitada, THE Serviço_Produtos SHALL reduzir o estoque disponível na quantidade reservada e persistir a alteração no Arquivo_JSON de produtos.
3. IF o Serviço_Pedidos solicita a reserva de uma quantidade maior que o estoque disponível de um Produto, THEN THE Serviço_Produtos SHALL recusar a reserva e retornar um erro de estoque insuficiente.
4. WHEN o Serviço_Pedidos solicita a devolução de uma quantidade reservada de um Produto, THE Serviço_Produtos SHALL aumentar o estoque disponível na quantidade devolvida e persistir a alteração no Arquivo_JSON de produtos.

### Requisito 3: Criação e Gestão do Carrinho

**User Story:** Como cliente, quero adicionar produtos a um carrinho e ajustar quantidades, para que eu possa montar minha compra antes de finalizá-la.

#### Critérios de Aceitação

1. WHEN o usuário solicita a criação de um carrinho, THE Serviço_Carrinho SHALL criar um Carrinho com identificador único e persistir o registro no Arquivo_JSON de carrinhos.
2. WHEN o usuário adiciona um produto a um carrinho informando identificador do produto e quantidade, THE Serviço_Carrinho SHALL consultar o Serviço_Produtos para confirmar a existência do Produto e validar a quantidade disponível.
3. IF a quantidade solicitada de um produto excede o estoque disponível informado pelo Serviço_Produtos, THEN THE Serviço_Carrinho SHALL recusar a adição do item e retornar uma mensagem de estoque insuficiente.
4. WHEN o Serviço_Carrinho adiciona um Item_Carrinho, THE Serviço_Carrinho SHALL registrar o preço unitário obtido do Serviço_Produtos e ignorar qualquer preço enviado pelo Frontend.
5. WHEN o usuário altera a quantidade de um item existente no carrinho, THE Serviço_Carrinho SHALL atualizar a quantidade do Item_Carrinho e persistir a alteração no Arquivo_JSON de carrinhos.
6. WHEN o usuário remove um item do carrinho, THE Serviço_Carrinho SHALL remover o Item_Carrinho correspondente e persistir a alteração no Arquivo_JSON de carrinhos.
7. WHEN o usuário solicita a limpeza de todos os itens de um carrinho, THE Serviço_Carrinho SHALL remover todos os Itens_Carrinho do Carrinho e persistir a alteração no Arquivo_JSON de carrinhos.
8. WHEN o usuário consulta um carrinho existente, THE Serviço_Carrinho SHALL retornar os itens, o Subtotal, o Frete e o Total recalculados.
9. IF o usuário consulta um carrinho por identificador inexistente, THEN THE Serviço_Carrinho SHALL retornar um erro com código de status 404 e mensagem descritiva.

### Requisito 4: Cálculo de Frete Simulado por CEP

**User Story:** Como cliente, quero informar um CEP e calcular o frete, para que eu veja o custo de entrega antes de finalizar a compra.

#### Critérios de Aceitação

1. WHEN o usuário informa um CEP válido para um carrinho, THE Serviço_Carrinho SHALL calcular o Frete a partir do primeiro dígito do CEP e do Subtotal do Carrinho.
2. WHERE o primeiro dígito do CEP está entre 0 e 3, THE Serviço_Carrinho SHALL definir o Frete em 1500 Centavos.
3. WHERE o primeiro dígito do CEP está entre 4 e 6, THE Serviço_Carrinho SHALL definir o Frete em 2500 Centavos.
4. WHERE o primeiro dígito do CEP está entre 7 e 9, THE Serviço_Carrinho SHALL definir o Frete em 3500 Centavos.
5. WHERE o Subtotal do Carrinho é maior que 50000 Centavos, THE Serviço_Carrinho SHALL definir o Frete em 0 Centavos.
6. THE Serviço_Carrinho SHALL aceitar CEP composto por oito dígitos com ou sem hífen.
7. IF o usuário informa um CEP que não possui exatamente oito dígitos, THEN THE Serviço_Carrinho SHALL recusar o cálculo e retornar um erro de validação de CEP.

### Requisito 5: Cálculo de Subtotal, Frete e Total

**User Story:** Como cliente, quero visualizar subtotal, frete e total do carrinho, para que eu entenda o valor da minha compra.

#### Critérios de Aceitação

1. WHEN o Serviço_Carrinho calcula o Subtotal de um Carrinho, THE Serviço_Carrinho SHALL somar o produto do preço unitário pela quantidade de cada Item_Carrinho.
2. WHEN o Serviço_Carrinho retorna os valores de um Carrinho, THE Serviço_Carrinho SHALL retornar o Total como a soma do Subtotal e do Frete.
3. WHERE um Carrinho não possui Frete calculado, THE Serviço_Carrinho SHALL considerar o Frete igual a 0 Centavos no cálculo do Total.
4. THE Frontend SHALL exibir o Subtotal, o Frete e o Total formatados em reais.

### Requisito 6: Finalização de Compra e Criação de Pedido

**User Story:** Como cliente, quero finalizar a compra e gerar um pedido, para que minha intenção de compra seja registrada com os dados corretos.

#### Critérios de Aceitação

1. WHEN o usuário solicita a finalização da compra informando nome do comprador, CEP, endereço e número, THE Serviço_Pedidos SHALL consultar o Serviço_Carrinho para obter os itens e os dados de entrega.
2. WHEN o Serviço_Pedidos recebe os itens do Serviço_Carrinho, THE Serviço_Pedidos SHALL validar novamente a existência, a quantidade, o preço e o estoque de cada produto junto ao Serviço_Produtos.
3. WHEN a validação dos itens é concluída com sucesso, THE Serviço_Pedidos SHALL solicitar ao Serviço_Produtos a reserva da quantidade de cada produto do pedido.
4. WHEN a reserva de estoque é concluída com sucesso, THE Serviço_Pedidos SHALL criar um Pedido com identificador único, registrar o Snapshot dos itens e valores e persistir o registro no Arquivo_JSON de pedidos com status PENDENTE.
5. IF o usuário repete a mesma tentativa de finalização de uma compra já convertida em Pedido, THEN THE Serviço_Pedidos SHALL evitar a criação de um Pedido duplicado e retornar o Pedido já existente.
6. IF o estoque de qualquer item é insuficiente durante a validação da finalização, THEN THE Serviço_Pedidos SHALL recusar a criação do Pedido e retornar uma mensagem de estoque insuficiente.
7. WHEN o Serviço_Pedidos cria um Pedido, THE Serviço_Pedidos SHALL registrar o nome do comprador, o CEP, o endereço, o número e o complemento opcional informados pelo usuário.

### Requisito 7: Pagamento Simulado e Status do Pedido

**User Story:** Como cliente, quero simular o pagamento de um pedido, para que eu veja o resultado da compra como aprovado ou recusado.

#### Critérios de Aceitação

1. WHEN o usuário solicita o pagamento simulado de um Pedido com a opção aprovada, THE Serviço_Pedidos SHALL atualizar o status do Pedido para PAGO e persistir a alteração no Arquivo_JSON de pedidos.
2. WHEN um Pedido tem o pagamento aprovado, THE Serviço_Pedidos SHALL solicitar ao Serviço_Carrinho a limpeza dos itens do Carrinho associado.
3. WHEN o usuário solicita o pagamento simulado de um Pedido com a opção recusada, THE Serviço_Pedidos SHALL atualizar o status do Pedido para PAGAMENTO_RECUSADO e persistir a alteração no Arquivo_JSON de pedidos.
4. WHEN um Pedido tem o pagamento recusado, THE Serviço_Pedidos SHALL solicitar ao Serviço_Produtos a devolução do estoque reservado de cada item do Pedido.
5. THE Serviço_Pedidos SHALL restringir o status de um Pedido aos valores PENDENTE, PAGO, PAGAMENTO_RECUSADO e CANCELADO.
6. WHEN o Frontend recebe o resultado do pagamento simulado, THE Frontend SHALL exibir ao usuário uma mensagem indicando pagamento aprovado ou recusado.
7. WHERE o catálogo de produtos é alterado após a criação de um Pedido, THE Serviço_Pedidos SHALL manter o Snapshot dos valores e atributos registrados no momento da compra.

### Requisito 8: Consulta de Pedidos e Histórico

**User Story:** Como cliente, quero consultar meus pedidos e seus detalhes, para que eu acompanhe o histórico das minhas compras.

#### Critérios de Aceitação

1. WHEN o usuário solicita a lista de pedidos, THE Serviço_Pedidos SHALL retornar todos os pedidos registrados com identificador, data de compra, total e status.
2. WHEN o usuário solicita um pedido por identificador existente, THE Serviço_Pedidos SHALL retornar os dados completos do Pedido, incluindo o Snapshot dos itens e as quantidades.
3. IF o usuário solicita um pedido por identificador inexistente, THEN THE Serviço_Pedidos SHALL retornar um erro com código de status 404 e mensagem descritiva.

### Requisito 9: Persistência em Arquivos JSON

**User Story:** Como operador do sistema, quero que cada serviço persista seus dados de forma confiável em arquivos JSON, para que as informações sobrevivam a reinícios de contêiner sem corrupção.

#### Critérios de Aceitação

1. IF o Arquivo_JSON de um serviço não existe ao iniciar, THEN THE serviço SHALL criar o Arquivo_JSON correspondente automaticamente.
2. WHEN um serviço grava dados em seu Arquivo_JSON, THE serviço SHALL executar a gravação de forma serializada com substituição atômica do arquivo.
3. WHEN um contêiner é reiniciado, THE serviço SHALL preservar os dados gravados anteriormente em seu Arquivo_JSON.
4. THE Serviço_Produtos, o Serviço_Carrinho e o Serviço_Pedidos SHALL ler e gravar exclusivamente o próprio Arquivo_JSON.
5. IF um serviço necessita de dados pertencentes a outro serviço, THEN THE serviço SHALL obter esses dados por requisição à API do outro serviço em vez de acessar diretamente o Arquivo_JSON alheio.

### Requisito 10: Comunicação Entre Serviços

**User Story:** Como operador do sistema, quero que os serviços se comuniquem apenas por APIs REST na rede Docker, para que a arquitetura de microsserviços seja demonstrada de forma clara e desacoplada.

#### Critérios de Aceitação

1. WHEN um serviço precisa de dados ou operações de outro serviço, THE serviço SHALL enviar uma requisição HTTP REST ao outro serviço usando o nome de serviço na Rede_Docker.
2. WHEN o Frontend acessa um serviço de backend, THE Frontend SHALL encaminhar a requisição por meio do Proxy_Frontend para evitar CORS e exposição de nomes internos de contêiner no navegador.
3. IF um serviço de backend está indisponível durante uma requisição, THEN THE serviço requisitante SHALL retornar uma mensagem de erro amigável indicando a indisponibilidade.
4. THE Serviço_Produtos, o Serviço_Carrinho e o Serviço_Pedidos SHALL comunicar-se entre si exclusivamente por requisições REST, sem acesso direto aos arquivos de dados uns dos outros.

### Requisito 11: Interface do Frontend

**User Story:** Como cliente, quero uma interface moderna e responsiva semelhante a uma loja online real, para que eu navegue, compre e acompanhe pedidos de forma intuitiva.

#### Critérios de Aceitação

1. THE Frontend SHALL exibir um catálogo de produtos em cards contendo imagem, nome, preço, categoria e disponibilidade, com ações de ver detalhes e adicionar ao carrinho.
2. THE Frontend SHALL fornecer um formulário de cadastro de produto com campos de nome, descrição, categoria, preço, estoque, imagem e atributos personalizados, incluindo uma ação de adicionar atributo com pares nome e valor e pré-visualização dos atributos.
3. THE Frontend SHALL permitir ao usuário editar e excluir produtos existentes.
4. THE Frontend SHALL exibir uma tela de detalhes do produto com todas as informações e os atributos dinâmicos, permitindo selecionar a quantidade e adicionar ao carrinho.
5. THE Frontend SHALL exibir uma tela de carrinho com os produtos adicionados, a quantidade de cada item, o preço unitário, o Subtotal, um campo de CEP, a ação de calcular frete, o valor do Frete, o Total e a ação de finalizar compra, permitindo remover itens e alterar quantidades.
6. THE Frontend SHALL exibir uma tela de checkout com o resumo final do pedido e campos para nome do comprador, CEP, endereço, número e complemento opcional, oferecendo as opções de simular pagamento aprovado ou recusado.
7. THE Frontend SHALL exibir uma tela de pedidos com o identificador, a data de compra, os produtos, as quantidades, o total e o status de cada pedido, permitindo abrir os detalhes completos.
8. WHEN o usuário aciona uma operação que depende de um serviço de backend, THE Frontend SHALL exibir um estado de carregamento e, ao final, uma mensagem de sucesso ou erro.
9. THE Frontend SHALL apresentar um layout responsivo com CSS moderno e valores monetários formatados em reais.

### Requisito 12: Conteinerização e Orquestração

**User Story:** Como operador do sistema, quero iniciar toda a aplicação com um único comando, para que os quatro serviços subam de forma independente e integrada.

#### Critérios de Aceitação

1. THE Sistema SHALL definir exatamente quatro serviços de aplicação: Frontend na porta 3000, Serviço_Produtos na porta 3001, Serviço_Carrinho na porta 3002 e Serviço_Pedidos na porta 3003.
2. THE Sistema SHALL fornecer um Dockerfile próprio para cada serviço e um único arquivo docker-compose.yml que orquestra os quatro serviços.
3. WHEN o operador executa o comando de inicialização com build, THE Sistema SHALL construir e iniciar os quatro serviços e disponibilizar o Frontend em http://localhost:3000.
4. THE Sistema SHALL configurar os arquivos de dados JSON como volumes Docker com bind mount no diretório do projeto.
5. THE Sistema SHALL fornecer as variáveis de ambiente com os endereços dos serviços para a comunicação entre contêineres.
6. WHILE um serviço dependente ainda não respondeu durante a inicialização, THE serviço requisitante SHALL tratar o erro temporário de comunicação sem encerrar o processo.
7. THE Sistema SHALL fornecer verificações de saúde simples para os serviços de backend.
