# Arquitetura - Carioca's Pro

## Visao Geral

Carioca's Pro e um sistema de gestao para hamburgueria construido com Next.js App Router, Firebase Firestore como banco de dados em tempo real, Firebase Auth para autenticacao e Evolution API para WhatsApp.

O projeto atual roda em Next.js 15.x, mantendo arquitetura compativel com App Router usado desde o Next.js 14.

```text
[Usuario/Navegador]
  |
  v
[Next.js - App Router]
  |
  |-- Paginas
  |   |-- /dashboard
  |   |-- /estoque
  |   |-- /financeiro
  |   |-- /financeiro/relatorios
  |   |-- /configuracoes/whatsapp
  |   `-- demais rotas
  |
  |-- API Routes
  |   |-- /api/whatsapp/*
  |   |-- /api/automacoes
  |   |-- /api/alertas/*
  |   |-- /api/health
  |   `-- /api/debug/env (somente desenvolvimento)
  |
  |-- Components
  |   |-- estoque/
  |   |-- alertas/
  |   |-- financeiro/
  |   |-- dashboard/
  |   `-- ui/
  |
  |-- Hooks
  |   |-- useEstoque.ts
  |   |-- useAlertas.ts
  |   |-- useFinanceiro.ts
  |   `-- useRelatorios.ts
  |
  `-- Services
      |-- whatsapp.service.ts
      |-- alertas.service.ts
      |-- financeiro.service.ts
      |-- relatorios.service.ts
      `-- reposicao.service.ts

[Firebase Firestore]
  |-- insumos
  |-- historico
  |-- alertas
  |-- automacaoLogs
  |-- categoriasInsumos
  |-- fornecedores
  |-- pedidos_compra
  `-- desperdicio

[Docker]
  `-- Evolution API (porta 8080)
      `-- Webhook: /api/whatsapp/webhook
```

## Modulos e Fluxos

### Estoque

- Pagina principal: `/estoque`
- Tempo real: `onSnapshot` do Firestore.
- KPIs: abaixo do minimo, proximo vencimento, sem fornecedor, precisa etiqueta, aumento de custo e margem baixa.
- Entrada rapida: codigo de barras, cache local e busca externa.
- Importacao XML: base para leitura de NF-e e processamento em lote.
- Drawer de produto: abas para dados, estoque, conversao, validade, fornecedores, etiqueta, ficha tecnica e historico.
- Validacao: schemas Zod para produto, fornecedor, XML e movimento.

### Alertas de Reposicao

- Motor backend: `src/server/stock-alerts.js`.
- Frontend em tempo real: `src/hooks/useAlertas.ts` lendo `alertas`.
- Niveis: `critical`, `warning` e `info`.
- Acoes: marcar como lido, resolver e abrir pedido por WhatsApp.
- Automacoes: entrada, saida, estoque baixo, vencendo, vencido e sugestao de compra.
- Topbar: badge com contagem de alertas nao lidos.

### Financeiro

- Paginas: `/financeiro` e `/financeiro/relatorios`.
- KPIs: custo total, faturamento estimado, margem media, CMV, desperdicio e ticket medio.
- Graficos: CSS puro, sem dependencia externa.
- Relatorios: filtro por periodo, top fornecedores, top insumos, compras por fornecedor e entradas por produto.
- Regra visual: verde para saudavel, amarelo para atencao, vermelho para critico.

### WhatsApp

- Evolution API em Docker.
- Webhook: `/api/whatsapp/webhook`.
- Envio fallback: `/api/whatsapp/send`.
- Configuracao visual: `/configuracoes/whatsapp`.
- IA Carioquinha responde mensagens e aciona servicos do sistema.

## Fluxo de Dados

```text
Entrada ou XML NF-e
  -> cria/atualiza produto
  -> atualiza estoque
  -> registra historico
  -> dispara automacao WhatsApp
  -> recalcula alertas de reposicao
  -> atualiza dashboards e relatorios
```

## Stack Tecnologica

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js App Router |
| Linguagem | TypeScript |
| Banco | Firebase Firestore |
| Auth | Firebase Auth |
| UI | React + CSS puro |
| Validacao | Zod |
| WhatsApp | Evolution API |
| Container | Docker Compose |
| Deploy sugerido | VPS Linux + Nginx + PM2 |

## Seguranca

- API Key da Evolution fica somente no servidor (`EVOLUTION_API_KEY`).
- Endpoint `/api/debug/env` bloqueia em producao.
- Health check e publico e nao revela segredo.
- Firebase Admin usa variaveis server-side.
- Regras do Firestore devem restringir documentos por usuario, perfil e plano.
- Acoes criticas devem ser limitadas a perfis administrativos.

