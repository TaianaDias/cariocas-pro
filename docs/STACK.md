# Stack Tecnologica - Carioca's Pro

## Tecnologias Principais

| Tecnologia | Versao no projeto | Uso |
| --- | --- | --- |
| Next.js | 15.x | Framework principal com App Router |
| React | 19.x | Interface |
| TypeScript | 5.x | Linguagem |
| Firebase | 11.x | Firestore e Auth |
| Firebase Admin | 13.x | Rotinas server-side e alertas |
| Zod | 4.x | Validacao de schemas |
| Evolution API | v2.3.7 | WhatsApp |
| Docker | 24+ | Container Evolution API |
| Node.js | 20 LTS recomendado | Runtime |

## Dependencias npm

```text
firebase
firebase-admin
next
react
react-dom
zod
typescript
@types/node
@types/react
@types/react-dom
```

## Integracoes

| Servico | Finalidade |
| --- | --- |
| Firebase Firestore | Dados em tempo real |
| Firebase Auth | Autenticacao |
| Firebase Admin | Scripts e motores server-side |
| Evolution API | WhatsApp |
| Docker Desktop | Desenvolvimento local da Evolution |
| PM2 | Processo Node em producao |
| Nginx | Reverse proxy |

## Estrutura de Pastas

```text
cariocas-pro/
|-- src/
|   |-- app/
|   |   |-- api/
|   |   |-- estoque/
|   |   |-- financeiro/
|   |   `-- configuracoes/
|   |-- components/
|   |   |-- estoque/
|   |   |-- alertas/
|   |   |-- financeiro/
|   |   `-- ui/
|   |-- hooks/
|   |-- services/
|   |-- schemas/
|   |-- lib/
|   `-- types/
|-- docker/
|-- docs/
|-- public/
|-- scripts/
`-- .env.local
```

## Padroes do Projeto

- CSS puro com tokens do Tema A.
- Sem biblioteca externa de graficos.
- Services isolam acesso a Firebase e APIs.
- Hooks concentram carregamento e estado de UI.
- API Routes fazem ponte server-side para automacoes e WhatsApp.
- Documentacao e scripts nao afetam o build do Next.js.

