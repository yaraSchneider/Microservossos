# Testes de Integração / Smoke

Este diretório contém um teste de **smoke** que exercita a **stack real** do
e-commerce ponta a ponta, via HTTP, provando a comunicação entre os quatro
serviços (Produtos, Carrinho, Pedidos e Frontend).

Diferente dos testes de cada serviço (que usam `fetch` mockado para isolar a
lógica), este teste roda **contra os contêineres em execução** e valida o
fluxo completo de verdade.

## O que é verificado

- `GET /health` de cada backend retorna `200 { "status": "ok" }` — _Req 12.7_.
- Criação de produto e confirmação de **persistência** pela listagem — _Req 9.1, 9.3_.
- **Carrinho → Produtos**: o carrinho consulta o catálogo e grava o preço
  oficial (ignorando preço enviado pelo cliente); o subtotal reflete o preço
  do catálogo — _Req 10.1, 10.4_.
- Cálculo de frete aplicando a regra de faixa / frete grátis.
- **Pedidos → Carrinho** e **Pedidos → Produtos**: finalização revalida e
  **reserva** o estoque; o snapshot do pedido é registrado com status
  `PENDENTE` — _Req 10.1, 10.4_.
- Pagamento aprovado move o pedido para `PAGO` (reserva mantida) e pagamento
  recusado **devolve** o estoque — _Req 7.1, 7.3, 7.4_.
- **Proxy do Frontend**: `GET /api/produtos` encaminha para o Serviço_Produtos
  e retorna a lista — _Req 10.2_.

## Pré-requisitos

- Node.js **18+** (usa o runner embutido `node:test` e o `fetch` global; sem
  dependências externas).
- A stack precisa estar **rodando** (Docker + Docker Compose).

## Como executar contra a stack rodando

1. Na **raiz do projeto**, suba tudo:

   ```bash
   docker compose up --build
   ```

   Aguarde os quatro serviços ficarem saudáveis (Frontend em
   `http://localhost:3000`; backends em 3001/3002/3003).

2. Em outro terminal, rode o smoke test a partir deste diretório:

   ```bash
   cd integration-tests
   node --test
   # ou, equivalente:
   npm test
   ```

## Auto-skip quando a stack não está rodando

O teste detecta no início se a stack está acessível (`GET` em
`PRODUTOS_URL/health`). Se os serviços **não** estiverem no ar (por exemplo,
em um ambiente sem Docker), o suite é **pulado graciosamente** com a mensagem:

> `stack não está rodando; execute docker compose up --build e rode novamente`

Ou seja, ele **não falha** — apenas sinaliza que a stack precisa estar de pé.
A checagem do proxy do Frontend também é tolerante: se apenas o Frontend não
estiver disponível, aquele passo é ignorado sem quebrar o suite.

## URLs configuráveis

As URLs base podem ser sobrescritas por variáveis de ambiente (padrões abaixo
correspondem às portas publicadas no `docker-compose.yml`):

| Variável        | Padrão                    |
| --------------- | ------------------------- |
| `PRODUTOS_URL`  | `http://localhost:3001`   |
| `CARRINHO_URL`  | `http://localhost:3002`   |
| `PEDIDOS_URL`   | `http://localhost:3003`   |
| `FRONTEND_URL`  | `http://localhost:3000`   |

Exemplo:

```bash
PRODUTOS_URL=http://localhost:3001 FRONTEND_URL=http://localhost:3000 node --test
```
