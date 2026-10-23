# Entrega 1 — Insumo pré-compra e ficha com custo confiável

Referência: 22/10/2026. Base: `ac9ab8f`, branch V2. Escopo encerrável: **cadastrar insumo sem compra → informar custo estimado ou pendente → montar ficha direta → salvar e reabrir → atualizar referência e conferir o custo atual**.

## Estado e evidência

| Estado | Resultado |
|---|---|
| Planejado | Escopo, regras, causas e limites documentados |
| Implementado | Domínio de custos, API servidor, formulário e integração à tela de precificação |
| Testado | Cálculos, API, regras do SDK e fluxo na aplicação real com Auth/Firestore Emulator; evidência detalhada abaixo |
| Homologado na operação | Pendente: roteiro abaixo precisa ser executado na V2 conciliada com o código da VPS |
| Publicado | Pendente: não houve alteração de VPS, banco real ou regras publicadas |

## Causas tratadas e regras preservadas

- A conversão R$ 35/kg → R$ 0,035/g não pode ser arredondada para R$ 0,04/g antes de calcular a porção. Custo unitário mantém oito casas; soma monetária fecha em centavos.
- Custo desconhecido é `null`, não zero. Ficha incompleta conserva composição, mas não ganha margem, CMV ou sugestão de preço aparentes.
- Insumo pré-compra tem saldo zero e custo de valorização do estoque zero. A referência estimada fica em campo separado, com origem, data e versão. Cadastro não gera recebimento, obrigação ou movimento fictício.
- O cadastro é compartilhado com a coleção de insumos usada pelo estoque. Não existe uma segunda lista de ingredientes sem vínculo.
- Quantidade da linha e unidade permanecem como informadas; custo é convertido para a unidade da receita. Unidade incompatível vira pendência.
- A API recebe composição e preço, calcula os resultados no servidor e rejeita custo calculado enviado pelo navegador.
- Empresa/loja/autor vêm do perfil verificado, não de campos manipuláveis no formulário. Papéis desconhecidos são negados no novo fluxo. A política Plus/Full existente para configurar custos foi preservada.
- Operação repetida com mesma chave/conteúdo devolve o mesmo resultado; conteúdo diferente com chave já utilizada retorna 409. Gravação de ficha, versão, auditoria e resultado idempotente é transacional.
- Edição usa versão esperada; sessão antiga recebe conflito. Erro não limpa o formulário. É possível remover uma linha incorreta da composição.
- Consulta atual recalcula referências sem regravar versões salvas. Alteração de custo de referência não modifica saldo, custo do estoque, preços de venda ou registros anteriores.
- A ficha visual já aberta usa o resultado atual da consulta, evitando mostrar o custo anterior após salvar uma nova referência.
- Médias informam quantas fichas possuem cálculo válido. Sem nenhuma ficha calculável, CMV e margem ficam pendentes; não aparecem como 0%. Essas médias simples por ficha não representam o CMV ponderado pelas vendas.
- Aplicação de preço continua sendo uma ação explícita. Ficha pendente não permite aplicar sugestão.

## Arquivos afetados

| Arquivo | Responsabilidade |
|---|---|
| `src/domain/custos.ts` | Precisão, unidades dimensionais, origem e custo ausente |
| `src/domain/precificacao.ts` | Cálculos puros extraídos do serviço existente; composição, pendências, sugestão básica e indicadores simulados |
| `src/services/precificacao.service.ts` | Preserva exports existentes e separa acesso Firebase de matemática |
| `src/schemas/precificacao.schema.ts` | Contratos estritos; unidades/fatores; limites; custo nullable; proibição de injetar saldo/tenant/cálculos |
| `src/server/catalogo-fichas.ts` | Leitura contextual; criação sem estoque; referência; persistência/versões/auditoria/idempotência |
| `src/app/api/precificacao/catalogo/route.ts` | GET e POST autenticados do fluxo |
| `src/app/api/precificacao/recalcular/route.ts` | Consulta via Admin SDK; atualização sem sobrescrever fichas com parâmetros padrão |
| `src/hooks/usePrecificacao.ts` | Carregamento após perfil, chamada autenticada, envio de composição, retry com mesma chave e cobertura das médias |
| `src/components/precificacao/InsumoParaFicha.tsx` | Cadastro pré-compra e edição explícita da referência estimada |
| `src/components/precificacao/PrecificacaoPageClient.tsx` | Integra os formulários, ficha aberta atualizada, unidades precisas, estado pendente, cobertura das médias, mensagens e remoção de ingredientes |
| `src/lib/firebase-emulators.ts`, `firebase.ts`, `server-auth.ts` | Conexão cliente/servidor aos emuladores somente em desenvolvimento/teste, projeto `demo-` e endereços locais explícitos |
| `src/types/index.ts` | Referência identificada, versão e campos financeiros nullable |
| `src/styles/precificacao.css` | Layout do formulário, controles de pelo menos 44 px e adaptação ao espaço disponível |
| `firestore.rules` | Fecha sobreposição da regra genérica de perfis e escrita direta nas coleções protegidas; restringe contexto da loja |
| `tests/unit/custos.test.ts` | Oito testes unitários de regras de negócio |
| `tests/unit/emulators.test.ts` | Teste das restrições da configuração local de emulação |
| `tests/integration/catalogo.test.ts` | Fluxo pelos handlers HTTP reais com Auth/Firestore Emulator e SDK cliente |
| `tests/ui/insumo-form.*` | Verificação isolada do formulário em navegador; callback controlado, não homologação operacional |
| `tests/ui/application-flow.mjs` | Fluxo pelo navegador e aplicação Next real, com persistência, duas sessões e conferência do banco emulado |
| `firebase.test.json`, `package.json`, lockfile | Comandos de teste reproduzíveis; projeto local `demo-` |
| `.github/workflows/build.yml` | Testes de negócio e emuladores também nos PRs para a branch V2 |
| `.gitignore` | Logs e cache de compilação não entram no versionamento |

O serviço legado de escrita de receita permanece exportado por compatibilidade, mas a tela de precificação agora usa o comando servidor. As regras desta entrega passam a negar gravações diretas de fichas pelo navegador. Consumidores externos/versões antigas precisam ser identificados na homologação.

## Verificações executadas

1. **Nove testes unitários:** oito de negócio (média ponderada do caso A; porções em gramas/kg; aumento/redução diretos; custo ausente e zero explícito; incompatibilidade de unidades/orfandade/preparação ainda não suportada; taxa no preço proposto, margem alvo zero e denominador impossível; schemas; perfil/plano/contexto) e um das restrições da emulação (rejeita produção, projeto real, destino remoto e endereço inválido/incompleto).
2. **Nove cenários de integração**, agrupados por um teste principal (o Node conta dez incluindo o agrupador): repetição simultânea do cadastro; conflito de payload; salvar/reler ficha; atualização de referência preservando dados anteriores; custo ausente persistido como null; autorização de empresa/loja/perfil; regras do SDK cliente; falha sem efeito parcial; versão de edição antiga rejeitada.
3. `npx tsc --noEmit`: verificação de tipos.
4. `npm run check:orthography`: verificação das ocorrências conhecidas de ortografia da interface.
5. `npm run build`: build Next.js com 53 páginas/rotas geradas. Há avisos legados em importação protobuf/Firestore de outras rotas e CSS de pedidos; compilação foi concluída.
6. **Aplicação completa no navegador:** login real no Auth Emulator; cadastro pré-compra pela tela; ficha de 160 g a R$ 35/kg salva e relida após recarregar por R$ 5,60; redução para R$ 25/kg atualiza a ficha ainda aberta para R$ 4,00; duas sessões editam a mesma ficha e a antiga recebe 409 sem perder o nome digitado; custo em branco produz ficha pendente e impede aplicar sugestão. Cobertura das médias muda de 1/2 para 0/2 quando a última referência conhecida é removida; os dois indicadores passam a “Pendente”. O banco emulado confirma dois insumos com saldo/custo de estoque zero, nenhum movimento de estoque e três versões de ficha. Sem rolagem horizontal nas larguras 390 e 1440 px.

Os testes usam dados fabricados exclusivamente no projeto local `demo-cariocas-pro`. Não foram lidos dados reais. O cenário de histórico sem alteração inclui um registro de venda de teste: comprova que o comando de referência não o reescreve; não comprova uma integração de vendas ainda inexistente.

Comandos:

```bash
npm ci
npm test
npm run test:emulators
npx tsc --noEmit
npm run check:orthography
npm run build
```

Emuladores: Java 17 e Node compatível com `--import`. A CLI Firebase de teste está fixada no comando; não é dependência do runtime da aplicação. Usa apenas portas locais 8085/9095 e projeto `demo-`.

Teste da aplicação completa (Next em desenvolvimento na porta local 3105, navegador e emuladores):

```bash
npx playwright install chromium
npm run test:app
```

O comando cria usuário/dados fabricados, percorre a interface sem substituir callbacks, verifica persistência e encerra o servidor ao terminar. Logs e capturas ficam em diretório temporário indicado na saída. O teste de navegador foi executado localmente; a CI deste PR cobre testes unitários, integração com emuladores e build, sem executar esse navegador. A aplicação só aceita a conexão emulada com configuração explícita de desenvolvimento/teste, projeto `demo-` e hosts locais; nenhuma credencial real é necessária.

Teste isolado de interface:

```bash
npx playwright install chromium
npm run test:ui
```

Se o ambiente disponibilizar outro Chromium, o script aceita `CHROMIUM_EXECUTABLE_PATH` e `CHROMIUM_ARGS` (array JSON). Ele testa envio de custo em branco como null, preservação do nome após erro, sucesso na repetição, rótulos/teclado e ausência de rolagem horizontal em 390 e 1440 px. Execução concluída: cenários aprovados em 390 e 1440 px, com Chromium 153 disponibilizado como binário local; a distribuição padrão do Playwright não pôde ser baixada neste ambiente. O teste usa callback controlado e não equivale a uma venda ou homologação na loja.

## Limites que permanecem

- Código atual da VPS e dados legados não foram comparados; registros sem tenant/loja explícitos não são incluídos pela nova leitura segura.
- As regras precisam ser homologadas após inventário/migração. Não são uma auditoria completa de todas as ações dos módulos. Fluxos legados ainda permitem alterações diretas de estoque por administradores; plano/campos sensíveis de todos os módulos exigem revisão própria.
- Esta entrega calcula insumos diretos. Preparações aninhadas são marcadas como pendentes; o motor de dependências e produção não foi declarado pronto.
- Referência estimada permanece explícita até alteração. A política que substitui/combina essa referência com a primeira compra deve ser implementada no recebimento da etapa 2.
- Não foram implementadas compras/AP, produção, vendas, baixa automática, conciliação ou DRE neste escopo. Há caminhos anteriores no repositório, mas sua presença não atesta integração.
- Taxas, embalagens e rateio fixo legados são parâmetros de simulação. A margem desta tela não é lucro líquido da loja. O painel financeiro geral ainda exige retirar métricas fixas e refazer a fonte de ticket/evolução.
- Backups, restauração, volume de produção e disponibilidade real não foram testados.
- Os campos `congelarCusto`/`congelarCmv` legados são preservados; fichas congeladas exigem regra de migração/homologação antes de exigir atualização automática em todos os casos.

## Roteiro de homologação fechado

1. Confirmar a versão V2 e comparar alterações locais da VPS; preparar backup e cópia isolada.
2. Entrar com administradora Plus/Full da loja de teste.
3. Em Precificação, cadastrar “Carne — teste pré-compra”: compra KG, uso G, fator 1000, referência R$ 35. Reabrir a página e selecionar o insumo.
4. Conferir saldo zero no cadastro; confirmar ausência de compra, entrada e conta a pagar criada pelo cadastro.
5. Criar ficha direta com 160 g e preço de venda R$ 20. Salvar, sair e voltar. Custo de ingredientes deve ser R$ 5,60; resultado deve aparecer como estimado.
6. Alterar referência para R$ 25/kg: custo atual R$ 4,00. Voltar a R$ 35: R$ 5,60. Versões anteriores permanecem identificáveis; saldo/valorização não mudam.
7. Cadastrar outro insumo com custo vazio e incluí-lo em ficha: composição salva, mas custo/margem/CMV/sugestão permanecem pendentes. Ao informar referência, a consulta passa a calcular. Conferir o número de fichas consideradas nas médias; sem custos conhecidos, os indicadores devem ficar pendentes.
8. Tentar fator errado para KG→G e unidade incompatível. Obter erro compreensível sem perda da ficha em edição.
9. Repetir envio e simular falha de rede; conferir uma criação e uma versão por operação, com auditoria.
10. Abrir mesma ficha em duas sessões e salvar uma. A outra deve receber conflito até recarregar.
11. Testar funcionário, plano negado, outra empresa e outra loja; nenhum acesso a custos privados ou gravação indevida.
12. Registrar versão, responsável, data e resultado de cada item. Só então marcar **homologado**; publicação é um estado separado.

Próximo fluxo: recebimento parcial transacional com média ponderada, histórico e uma única obrigação financeira vinculada. Não expandir automaticamente o escopo da entrega 1 enquanto esta homologação estiver aberta.
