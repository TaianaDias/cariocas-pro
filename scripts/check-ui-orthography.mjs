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
  ["automacao", "automação"],
  ["automacoes", "automações"],
  ["codigo", "código"],
  ["codigos", "códigos"],
  ["configuracao", "configuração"],
  ["configuracoes", "configurações"],
  ["critico", "crítico"],
  ["criticos", "críticos"],
  ["descricao", "descrição"],
  ["disponivel", "disponível"],
  ["disponiveis", "disponíveis"],
  ["endereco", "endereço"],
  ["funcionario", "funcionário"],
  ["funcionarios", "funcionários"],
  ["gestao", "gestão"],
  ["historico", "histórico"],
  ["historicos", "históricos"],
  ["invalido", "inválido"],
  ["invalidos", "inválidos"],
  ["modulo", "módulo"],
  ["modulos", "módulos"],
  ["nao", "não"],
  ["numero", "número"],
  ["numeros", "números"],
  ["observacao", "observação"],
  ["observacoes", "observações"],
  ["operacao", "operação"],
  ["permissao", "permissão"],
  ["permissoes", "permissões"],
  ["possivel", "possível"],
  ["producao", "produção"],
  ["porcao", "porção"],
  ["porcoes", "porções"],
  ["proximo", "próximo"],
  ["proximos", "próximos"],
  ["relatorio", "relatório"],
  ["relatorios", "relatórios"],
  ["responsavel", "responsável"],
  ["responsaveis", "responsáveis"],
  ["sessao", "sessão"],
  ["tecnica", "técnica"],
  ["tecnicas", "técnicas"],
  ["tecnico", "técnico"],
  ["tecnicos", "técnicos"],
  ["usuario", "usuário"],
  ["usuarios", "usuários"],
  ["vinculo", "vínculo"],
  ["vinculos", "vínculos"],
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

function replaceQuotedStrings(line, shouldFix) {
  return line.replace(/(["'`])((?:\\.|(?!\1).)*)\1/g, (full, quote, value, offset) => {
    if (!value || value.startsWith("/") || value.startsWith("http")) return full;
    if (!shouldFix({ line, offset, value })) return full;
    const fixed = fixText(value);
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
