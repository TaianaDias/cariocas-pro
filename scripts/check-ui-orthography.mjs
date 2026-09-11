import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src/app", "src/components", "src/config", "src/hooks"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

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

function visibleSegments(line) {
  const segments = [];
  const uiMarker = /(?:label|title|subtitle|description|eyebrow|placeholder|aria-label)\s*=|<(?:Button|strong|span|small|option|h1|h2|h3|p)\b|new Error\(|NextResponse\.json\(|set(?:Error|Erro|Resultado)\(|window\.confirm\(/;

  const jsxText = />\s*([^<>{}\n][^<>{}]*)\s*</g;
  for (const match of line.matchAll(jsxText)) segments.push(match[1]);

  if (uiMarker.test(line)) {
    const strings = /(["'`])((?:(?!\1).)*)\1/g;
    for (const match of line.matchAll(strings)) {
      const value = match[2].trim();
      if (!value || value.startsWith("/") || value.startsWith("http")) continue;
      segments.push(value);
    }
  }

  return segments;
}

const issues = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const segment of visibleSegments(line)) {
        const lower = segment.toLocaleLowerCase("pt-BR");
        for (const [wrong, right] of corrections) {
          const re = new RegExp(`(^|[^\\p{L}])${wrong}([^\\p{L}]|$)`, "iu");
          if (re.test(lower)) {
            issues.push({ file, line: index + 1, segment, wrong, right });
          }
        }
      }
    });
  }
}

if (issues.length) {
  console.error("\nOrtografia da interface: foram encontrados textos que precisam de revisão.\n");
  for (const issue of issues) {
    console.error(`${issue.file}:${issue.line} — “${issue.segment}” — revise “${issue.wrong}” → “${issue.right}”`);
  }
  console.error(`\nTotal: ${issues.length} ocorrência(s).\n`);
  process.exit(1);
}

console.log("Ortografia da interface: verificação concluída sem ocorrências conhecidas.");
