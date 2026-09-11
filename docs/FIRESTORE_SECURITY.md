# Segurança do Firestore — Dashboard Clean V2

## Estado atual

O arquivo `firestore.rules` desta branch define o modelo alvo de acesso multi-tenant:

- administradores (`admin`, `dono`, `proprietario` e o legado `user`) acessam somente dados da própria empresa/loja;
- perfis operacionais (`gerente` e `funcionario`) não recebem coleções financeiras completas pelo SDK do navegador;
- categorias de estoque podem ser lidas pela equipe porque não carregam custo, CMV ou margem;
- usuários da equipe são provisionados pela API server-side `/api/funcionarios`;
- documentos raiz antigos sem `empresaId` ficam bloqueados pelas regras alvo.

## Importante: não publicar as regras antes da migração dos legados

Parte do sistema ainda possui coleções raiz históricas e alguns documentos antigos podem não ter `empresaId` e `lojaId`. As regras foram desenhadas para **negar** esses documentos sem tenant, porque permitir acesso a registros sem dono definido abriria risco de vazamento entre empresas.

Antes do deploy das regras em produção:

1. fazer inventário das coleções raiz ainda usadas pelo cliente;
2. identificar documentos sem `empresaId`/`lojaId`;
3. migrar esses documentos para o tenant correto ou para as subcoleções de `empresas/{empresaId}`;
4. validar administrador e funcionário em ambiente isolado;
5. somente então publicar as regras.

## Funcionários

O gerenciamento da equipe não deve voltar a fazer CRUD direto em `funcionarios` ou `usuarios` pelo navegador. A API `/api/funcionarios`:

- verifica o Firebase ID Token no servidor;
- exige papel administrativo;
- força `empresaId` e `lojaId` do administrador autenticado;
- aceita somente os papéis `funcionario` e `gerente`;
- filtra permissões para a lista operacional aprovada;
- cria/desabilita a conta no Firebase Auth;
- revoga refresh tokens ao desativar;
- mantém `usuarios/{uid}` e `funcionarios/{uid}` sincronizados.

## Critério para liberar credencial real de funcionário

Não criar credenciais de funcionário para uso em produção até que as regras tenham sido testadas e publicadas. A restrição visual do menu é apenas experiência de interface; a autorização real precisa estar garantida no servidor e nas regras do Firestore.
