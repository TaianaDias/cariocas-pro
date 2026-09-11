import fs from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const ROOTS = ["src/app", "src/components", "src/config", "src/hooks"];
const EXTENSIONS = new Set([".ts", ".tsx"]);
const TEXT_PROPS = new Set(["label", "title", "subtitle", "description", "eyebrow", "placeholder", "aria-label"]);

const corrections = new Map([
  ["acao", "ação"],
  ["acoes", "ações"],
  ["administracao", "administração"],
  ["analise", "análise"],
  ["analises", "análises"],
  ["aparecerao", "aparecerão"],
  ["aplicacao", "aplicação"],
  ["area", "área"],
  ["atencao", "atenção"],
  ["autenticacao", "autenticação"],
  ["automacao", "automação"],
  ["automacoes", "automações"],
  ["automatico", "automático"],
  ["automatica", "automática"],
  ["automaticos", "automáticos"],
  ["automaticas", "automáticas"],
  ["camera", "câmera"],
  ["codigo", "código"],
  ["codigos", "códigos"],
  ["colecao", "coleção"],
  ["colecoes", "coleções"],
  ["configuracao", "configuração"],
  ["configuracoes", "configurações"],
  ["conseguira", "conseguirá"],
  ["conversao", "conversão"],
  ["critico", "crítico"],
  ["criticos", "críticos"],
  ["descricao", "descrição"],
  ["digito", "dígito"],
  ["digitos", "dígitos"],
  ["dinamico", "dinâmico"],
  ["dinamica", "dinâmica"],
  ["disponivel", "disponível"],
  ["disponiveis", "disponíveis"],
  ["endereco", "endereço"],
  ["exclusao", "exclusão"],
  ["frequencia", "frequência"],
  ["funcao", "função"],
  ["funcoes", "funções"],
  ["funcionario", "funcionário"],
  ["funcionarios", "funcionários"],
  ["gestao", "gestão"],
  ["historico", "histórico"],
  ["historicos", "históricos"],
  ["importacao", "importação"],
  ["invalido", "inválido"],
  ["invalidos", "inválidos"],
  ["localizacao", "localização"],
  ["modulo", "módulo"],
  ["modulos", "módulos"],
  ["nao", "não"],
  ["numero", "número"],
  ["numeros", "números"],
  ["obrigatorio", "obrigatório"],
  ["obrigatoria", "obrigatória"],
  ["obrigatorios", "obrigatórios"],
  ["obrigatorias", "obrigatórias"],
  ["observacao", "observação"],
  ["observacoes", "observações"],
  ["operacao", "operação"],
  ["padrao", "padrão"],
  ["permissao", "permissão"],
  ["permissoes", "permissões"],
  ["possivel", "possível"],
  ["precificacao", "precificação"],
  ["preco", "preço"],
  ["precos", "preços"],
  ["prejuizo", "prejuízo"],
  ["producao", "produção"],
  ["porcao", "porção"],
  ["porcoes", "porções"],
  ["proximo", "próximo"],
  ["proximos", "próximos"],
  ["relatorio", "relatório"],
  ["relatorios", "relatórios"],
  ["reposicao", "reposição"],
  ["reposicoes", "reposições"],
  ["responsavel", "responsável"],
  ["responsaveis", "responsáveis"],
  ["restauracao", "restauração"],
  ["sao", "são"],
  ["secao", "seção"],
  ["secoes", "seções"],
  ["sera", "será"],
  ["serao", "serão"],
  ["sessao", "sessão"],
  ["simulacao", "simulação"],
  ["simulacoes", "simulações"],
  ["so", "só"],
  ["sugestao", "sugestão"],
  ["tambem", "também"],
  ["tecnica", "técnica"],
  ["tecnicas", "técnicas"],
  ["tecnico", "técnico"],
  ["tecnicos", "técnicos"],
  ["usuario", "usuário"],
  ["usuarios", "usuários"],
  ["valido", "válido"],
  ["validos", "válidos"],
  ["vinculo", "vínculo"],
  ["vinculos", "vínculos"],
  ["voce", "você"],
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preserveCase(source, replacement) {
  if (source === source.toLocaleUpperCase("pt-BR")) {
    return replacement.toLocaleUpperCase("pt-BR");
  }

  if (source[0] === source[0]?.toLocaleUpperCase("pt-BR")) {
    return replacement[0].toLocaleUpperCase("pt-BR") + replacement.slice(1);
  }

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

  const flushCode = () => {
    output += repairCodeSegment(codeBuffer);
    codeBuffer = "";
  };

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];

    if (quote) {
      output += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      flushCode();
      quote = char;
      output += char;
      continue;
    }

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

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

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
    if (interpolationStart === -1) {
      output += fixText(value.slice(cursor));
      break;
    }

    output += fixText(value.slice(cursor, interpolationStart));
    const expressionStart = interpolationStart + 2;
    const interpolationEnd = findInterpolationEnd(value, expressionStart);

    if (interpolationEnd === -1) {
      output += value.slice(interpolationStart);
      break;
    }

    const expression = value.slice(expressionStart, interpolationEnd);
    output += `\${${repairInterpolationExpression(expression)}}`;
    cursor = interpolationEnd + 1;
  }

  return output;
}

function replaceQuotedStrings(line, shouldFix) {
  return line.replace(/(["'`])((?:\\.|(?!\1).)*)\1/g, (full, quote, value, offset) => {
    if (!value || value.startsWith("/") || value.startsWith("http")) return full;
    if (!shouldFix({ line, offset, value })) return full;
    const fixed = quote === "`" ? fixTemplateLiteral(value) : fixText(value);
    return `${quote}${fixed}${quote}`;
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

function fixVisibleLine(line) {
  let output = line;

  // Texto JSX puro, por exemplo: <span>Historico</span>.
  output = output.replace(/>\s*([^<>{}\n][^<>{}]*)\s*</g, (full, value) => full.replace(value, fixText(value)));

  const hasTextProp = /\b(?:label|title|subtitle|description|eyebrow|placeholder|aria-label)\s*=/.test(output);
  const hasTextElement = /<(?:Button|strong|span|small|option|h1|h2|h3|p)\b/.test(output);
  const hasMessageCall = /new Error\(|NextResponse\.json\(|set(?:Error|Erro|Resultado)\(|window\.confirm\(/.test(output);

  if (hasMessageCall) {
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
      if (fixed !== line) {
        issues.push({ file, line: index + 1, before: line.trim(), after: fixed.trim() });
      }
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
