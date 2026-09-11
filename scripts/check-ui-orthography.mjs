import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const ROOTS = [
  "src/app",
  "src/components",
  "src/config",
  "src/hooks",
  "src/lib",
  "src/contexts",
  "src/services",
  "src/schemas",
  "src/server",
];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const TEXT_PROPS = new Set([
  "label", "title", "subtitle", "description", "descricao", "eyebrow", "placeholder",
  "aria-label", "aria-description", "helperText", "caption", "hint", "tooltip", "alt",
  "emptyText", "emptyTitle",
]);
const TEXT_OBJECT_KEYS = new Set([
  "label", "title", "subtitle", "description", "descricao", "eyebrow", "placeholder", "risk",
  "message", "mensagem", "helperText", "caption", "hint", "tooltip", "alt", "emptyText", "emptyTitle",
]);

const corrections = new Map([
  ["acao", "ação"], ["acoes", "ações"], ["administracao", "administração"], ["alteracao", "alteração"],
  ["alteracoes", "alterações"], ["analise", "análise"], ["analises", "análises"], ["aparecerao", "aparecerão"],
  ["aplicacao", "aplicação"], ["apos", "após"], ["area", "área"], ["ate", "até"], ["atencao", "atenção"],
  ["atualizacao", "atualização"], ["atualizacoes", "atualizações"], ["autenticacao", "autenticação"],
  ["automacao", "automação"], ["automacoes", "automações"], ["automatico", "automático"], ["automatica", "automática"],
  ["automaticos", "automáticos"], ["automaticas", "automáticas"], ["avancado", "avançado"], ["avancada", "avançada"],
  ["avancados", "avançados"], ["avancadas", "avançadas"], ["basico", "básico"], ["basica", "básica"],
  ["basicos", "básicos"], ["basicas", "básicas"], ["camera", "câmera"], ["cartao", "cartão"], ["cartoes", "cartões"],
  ["codigo", "código"], ["codigos", "códigos"], ["colecao", "coleção"], ["colecoes", "coleções"],
  ["conclusao", "conclusão"], ["conclusoes", "conclusões"], ["conexao", "conexão"], ["configuracao", "configuração"],
  ["configuracoes", "configurações"], ["conseguira", "conseguirá"], ["conteudo", "conteúdo"], ["conversao", "conversão"],
  ["credito", "crédito"], ["critica", "crítica"], ["criticas", "críticas"], ["critico", "crítico"], ["criticos", "críticos"],
  ["debito", "débito"], ["decisao", "decisão"], ["decisoes", "decisões"], ["descricao", "descrição"],
  ["digito", "dígito"], ["digitos", "dígitos"], ["dinamico", "dinâmico"], ["dinamica", "dinâmica"],
  ["disponivel", "disponível"], ["disponiveis", "disponíveis"], ["edicao", "edição"], ["edicoes", "edições"],
  ["economico", "econômico"], ["economica", "econômica"], ["economicos", "econômicos"], ["economicas", "econômicas"],
  ["endereco", "endereço"], ["evolucao", "evolução"], ["exclusao", "exclusão"], ["exportacao", "exportação"],
  ["facil", "fácil"], ["frequencia", "frequência"], ["funcao", "função"], ["funcoes", "funções"],
  ["funcionario", "funcionário"], ["funcionarios", "funcionários"], ["gestao", "gestão"], ["historico", "histórico"],
  ["historicos", "históricos"], ["identificacao", "identificação"], ["identificacoes", "identificações"],
  ["importacao", "importação"], ["inclusao", "inclusão"], ["informacao", "informação"], ["informacoes", "informações"],
  ["integracao", "integração"], ["integracoes", "integrações"], ["invalido", "inválido"], ["invalidos", "inválidos"],
  ["ja", "já"], ["liberacao", "liberação"], ["liberacoes", "liberações"], ["localizacao", "localização"],
  ["maxima", "máxima"], ["maximas", "máximas"], ["maximo", "máximo"], ["maximos", "máximos"],
  ["media", "média"], ["medio", "médio"], ["mes", "mês"], ["metodo", "método"], ["metodos", "métodos"],
  ["minima", "mínima"], ["minimas", "mínimas"], ["minimo", "mínimo"], ["minimos", "mínimos"],
  ["modulo", "módulo"], ["modulos", "módulos"], ["movimentacao", "movimentação"], ["movimentacoes", "movimentações"],
  ["nao", "não"], ["nivel", "nível"], ["niveis", "níveis"], ["notificacao", "notificação"], ["notificacoes", "notificações"],
  ["numero", "número"], ["numeros", "números"], ["obrigatorio", "obrigatório"], ["obrigatoria", "obrigatória"],
  ["obrigatorios", "obrigatórios"], ["obrigatorias", "obrigatórias"], ["observacao", "observação"], ["observacoes", "observações"],
  ["opcao", "opção"], ["opcoes", "opções"], ["operacao", "operação"], ["operacoes", "operações"],
  ["pagina", "página"], ["paginas", "páginas"], ["padrao", "padrão"], ["padroes", "padrões"], ["paes", "pães"],
  ["pendencia", "pendência"], ["pendencias", "pendências"], ["periodo", "período"], ["permissao", "permissão"], ["permissoes", "permissões"],
  ["possivel", "possível"], ["precificacao", "precificação"], ["preco", "preço"], ["precos", "preços"], ["prejuizo", "prejuízo"],
  ["previsao", "previsão"], ["previsoes", "previsões"], ["producao", "produção"], ["propria", "própria"], ["proprio", "próprio"],
  ["porcao", "porção"], ["porcoes", "porções"], ["proximo", "próximo"], ["proximos", "próximos"], ["publico", "público"],
  ["rapida", "rápida"], ["rapidas", "rápidas"], ["rapido", "rápido"], ["rapidos", "rápidos"],
  ["referencia", "referência"], ["referencias", "referências"], ["relacao", "relação"], ["relacoes", "relações"],
  ["relatorio", "relatório"], ["relatorios", "relatórios"], ["reposicao", "reposição"], ["reposicoes", "reposições"],
  ["responsavel", "responsável"], ["responsaveis", "responsáveis"], ["restauracao", "restauração"], ["restricao", "restrição"], ["restricoes", "restrições"],
  ["revisao", "revisão"], ["revisoes", "revisões"], ["saida", "saída"], ["saidas", "saídas"], ["sao", "são"],
  ["secao", "seção"], ["secoes", "seções"], ["seguranca", "segurança"], ["selecao", "seleção"], ["selecoes", "seleções"],
  ["sequencia", "sequência"], ["sequencias", "sequências"], ["sera", "será"], ["serao", "serão"], ["sessao", "sessão"],
  ["simulacao", "simulação"], ["simulacoes", "simulações"], ["situacao", "situação"], ["situacoes", "situações"], ["so", "só"],
  ["solicitacao", "solicitação"], ["solicitacoes", "solicitações"], ["sugestao", "sugestão"], ["sugestoes", "sugestões"], ["tambem", "também"],
  ["tecnica", "técnica"], ["tecnicas", "técnicas"], ["tecnico", "técnico"], ["tecnicos", "técnicos"],
  ["ultima", "última"], ["ultimas", "últimas"], ["ultimo", "último"], ["ultimos", "últimos"],
  ["unica", "única"], ["unicas", "únicas"], ["unico", "único"], ["unicos", "únicos"],
  ["unitaria", "unitária"], ["unitarias", "unitárias"], ["unitario", "unitário"], ["unitarios", "unitários"],
  ["usuario", "usuário"], ["usuarios", "usuários"], ["util", "útil"], ["uteis", "úteis"], ["validacao", "validação"], ["validacoes", "validações"],
  ["valido", "válido"], ["validos", "válidos"], ["versao", "versão"], ["versoes", "versões"], ["vinculo", "vínculo"], ["vinculos", "vínculos"],
  ["visao", "visão"], ["voce", "você"],
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function preserveCase(source, replacement) {
  if (source === source.toLocaleUpperCase("pt-BR")) return replacement.toLocaleUpperCase("pt-BR");
  if (source[0] === source[0]?.toLocaleUpperCase("pt-BR")) return replacement[0].toLocaleUpperCase("pt-BR") + replacement.slice(1);
  return replacement;
}
function fixText(value) {
  let output = value;
  for (const [wrong, right] of corrections) {
    const re = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(wrong)})(?=[^\\p{L}]|$)`, "giu");
    output = output.replace(re, (_match, prefix, word) => `${prefix}${preserveCase(word, right)}`);
  }
  return output;
}
function repairCodeSegment(segment) {
  let output = segment;
  for (const [wrong, right] of corrections) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}_$])(${escapeRegExp(right)})(?=[^\\p{L}\\p{N}_$]|$)`, "giu");
    output = output.replace(re, (_match, prefix, word) => `${prefix}${preserveCase(word, wrong)}`);
  }
  return output;
}
function repairInterpolationExpression(expression) {
  let output = "";
  let codeBuffer = "";
  let quote = null;
  let escaped = false;
  const flushCode = () => { output += repairCodeSegment(codeBuffer); codeBuffer = ""; };
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (quote) {
      output += char;
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { flushCode(); quote = char; output += char; continue; }
    codeBuffer += char;
  }
  flushCode();
  return output;
}
function findInterpolationEnd(value, start) {
  let depth = 1;
  let quote = null;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (quote) { if (char === quote) quote = null; continue; }
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}
function fixTemplateLiteral(value) {
  let output = "";
  let cursor = 0;
  while (cursor < value.length) {
    const interpolationStart = value.indexOf("${", cursor);
    if (interpolationStart === -1) { output += fixText(value.slice(cursor)); break; }
    output += fixText(value.slice(cursor, interpolationStart));
    const expressionStart = interpolationStart + 2;
    const interpolationEnd = findInterpolationEnd(value, expressionStart);
    if (interpolationEnd === -1) { output += value.slice(interpolationStart); break; }
    const expression = value.slice(expressionStart, interpolationEnd);
    output += `\${${repairInterpolationExpression(expression)}}`;
    cursor = interpolationEnd + 1;
  }
  return output;
}
function fixLiteral(quote, value) { return quote === "`" ? fixTemplateLiteral(value) : fixText(value); }
function replaceQuotedStrings(line, shouldFix) {
  return line.replace(/(["'`])((?:\\.|(?!\1).)*)\1/g, (full, quote, value, offset) => {
    if (!value || value.startsWith("/") || value.startsWith("http")) return full;
    if (!shouldFix({ line, offset, value })) return full;
    return `${quote}${fixLiteral(quote, value)}${quote}`;
  });
}
function isInsideNonTextAttribute(line, offset) {
  const before = line.slice(0, offset);
  const directAttribute = before.match(/([A-Za-z0-9_-]+)\s*=\s*$/);
  if (directAttribute && !TEXT_PROPS.has(directAttribute[1])) return true;
  const expressionAttribute = before.match(/([A-Za-z0-9_-]+)\s*=\s*\{[^{}]*$/);
  if (expressionAttribute && !TEXT_PROPS.has(expressionAttribute[1])) return true;
  return false;
}
function fixObjectTextProperties(line) {
  return line.replace(/\b([A-Za-z0-9_-]+)\s*:\s*(["'`])((?:\\.|(?!\2).)*)\2/g, (full, key, quote, value) => {
    if (!TEXT_OBJECT_KEYS.has(key) || !value || value.startsWith("/") || value.startsWith("http")) return full;
    const fixed = fixLiteral(quote, value);
    return full.replace(`${quote}${value}${quote}`, `${quote}${fixed}${quote}`);
  });
}
function fixVisibleLine(line) {
  let output = line;
  output = output.replace(/>\s*([^<>{}\n][^<>{}]*)\s*</g, (full, value) => full.replace(value, fixText(value)));
  output = fixObjectTextProperties(output);
  const hasTextProp = /\b(?:label|title|subtitle|description|descricao|eyebrow|placeholder|aria-label|aria-description|helperText|caption|hint|tooltip|alt|emptyText|emptyTitle)\s*=/.test(output);
  const hasTextElement = /<(?:Button|Badge|Title|strong|span|small|option|h1|h2|h3|h4|p|dt|dd|th|td|label|legend)\b/.test(output);
  const hasMessageCall = /(?:new Error|NextResponse\.json|window\.(?:alert|confirm)|(?:alert|confirm|toast|notify|showToast)\s*\(|set[A-Za-z0-9_]*(?:Error|Erro|Message|Mensagem|Resultado|Feedback|Aviso|Alerta|Sucesso)\s*\()/i.test(output);
  const hasVisibleAssignment = /\b(?:const|let)\s+[A-Za-z0-9_]*(?:Label|Title|Subtitle|Description|Message|Mensagem|Placeholder|Hint|Texto|Text)\b\s*=/i.test(output);
  if (hasMessageCall || hasVisibleAssignment) {
    output = replaceQuotedStrings(output, () => true);
  } else if (hasTextProp || hasTextElement) {
    output = replaceQuotedStrings(output, ({ line: source, offset }) => !isInsideNonTextAttribute(source, offset));
  }
  return output;
}

const issues = [];
let changedFiles = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const original = fs.readFileSync(file, "utf8");
    const hadFinalNewline = original.endsWith("\n");
    const lines = original.split(/\r?\n/);
    const fixedLines = lines.map((line, index) => {
      const fixed = fixVisibleLine(line);
      if (fixed !== line) issues.push({ file, line: index + 1, before: line.trim(), after: fixed.trim() });
      return fixed;
    });
    if (WRITE && issues.some((issue) => issue.file === file)) {
      let next = fixedLines.join("\n");
      if (hadFinalNewline && !next.endsWith("\n")) next += "\n";
      fs.writeFileSync(file, next, "utf8");
      changedFiles += 1;
    }
  }
}
if (WRITE) {
  console.log(`Ortografia da interface: ${issues.length} ajuste(s) aplicado(s) em ${changedFiles} arquivo(s).`);
  process.exit(0);
}
if (issues.length) {
  console.error("\nOrtografia da interface: foram encontrados textos que precisam de revisão.\n");
  for (const issue of issues) {
    console.error(`${issue.file}:${issue.line}`);
    console.error(`  antes: ${issue.before}`);
    console.error(`  depois: ${issue.after}`);
  }
  console.error(`\nTotal: ${issues.length} linha(s) com ajuste(s).\n`);
  process.exit(1);
}
console.log("Ortografia da interface: verificação concluída sem ocorrências conhecidas.");
