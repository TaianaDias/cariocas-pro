# Dashboard V2

A Dashboard V2 substitui a home antiga por uma central unica, responsiva e orientada por perfil.

## Regras de arquitetura

- Uma unica fonte de navegacao em `src/config/navigation.ts`.
- Uma unica Sidebar para desktop e mobile.
- Um unico conjunto de componentes da dashboard.
- Tema claro como padrao e tema escuro como alternativa.
- Sem dados financeiros na experiencia operacional.
- Modulos futuros aparecem como planejados, sem rotas quebradas.
- Componentes legados da dashboard antiga foram removidos.
- Antes do merge em `master`: executar build, validar 360/390/768 px e desktop, testar light/dark e perfis administrativo/funcionario.

## Secoes

1. Operacao
2. Rotinas e Padroes
3. Relatorios
4. Administracao (somente perfis administrativos)

## Proxima etapa

Migrar os modulos internos para os tokens semanticos de tema e reforcar a autorizacao server-side antes de liberar credenciais reais para funcionarios.
