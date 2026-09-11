import { canOpenPath, type Plano } from "./plan";
import type { PapelUsuario, PermissaoFuncionario } from "../types";

export const employeePermissionOptions: { label: string; permission: PermissaoFuncionario; path: string; risk?: string }[] = [
  { label: "Dashboard", path: "/dashboard", permission: "dashboard.ver" },
  { label: "Estoque e Reposição", path: "/estoque", permission: "estoque.ver" },
  { label: "Compras / Movimentações", path: "/compras", permission: "compras.ver" },
  { label: "Produção", path: "/producao", permission: "producao.ver" },
  { label: "Rotinas e Padrões", path: "/rotinas", permission: "rotinas.ver" as PermissaoFuncionario },
  { label: "Desperdício", path: "/desperdicio", permission: "desperdicio.ver" },
  { label: "Relatórios", path: "/relatorios", permission: "relatorios.ver" },
];

export const operationalEmployeePermissions = employeePermissionOptions.map((item) => item.permission);

const administrativeRoles: PapelUsuario[] = ["admin", "dono", "proprietario", "user"];
const operationalRoles: PapelUsuario[] = ["gerente", "funcionario"];
const administrativePaths = ["/precificacao", "/financeiro", "/fornecedores", "/funcionarios", "/configuracoes"];
const operationallySafePaths = ["/dashboard", "/estoque", "/reposicao", "/compras", "/producao", "/rotinas", "/desperdicio", "/relatorios"];

export function normalizeRole(role?: string | null): PapelUsuario {
  if (role === "admin" || role === "dono" || role === "proprietario" || role === "gerente" || role === "funcionario") {
    return role;
  }

  // Mantemos "user" como administrativo por compatibilidade com contas antigas.
  // A migração de papéis pode remover este fallback em uma etapa separada.
  return "user";
}

export function isAdministrativeRole(role?: PapelUsuario | string | null) {
  return administrativeRoles.includes(normalizeRole(role));
}

export function isOperationalRole(role?: PapelUsuario | string | null) {
  return operationalRoles.includes(normalizeRole(role));
}

export function isAdministrativePath(pathname: string) {
  return administrativePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function isOperationallySafePath(pathname: string) {
  return operationallySafePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function parsePermissions(value?: string | null): PermissaoFuncionario[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as PermissaoFuncionario[];
}

export function serializePermissions(permissions?: readonly string[]) {
  return [...new Set(permissions || [])].join(",");
}

export function getPermissionForPath(pathname: string): PermissaoFuncionario | null {
  if (pathname === "/reposicao" || pathname.startsWith("/reposicao/")) {
    return "estoque.ver";
  }

  const match = employeePermissionOptions
    .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];

  return match?.permission || null;
}

export function canAccessAppPath({
  path,
  permissions,
  plan,
  role,
}: {
  path: string;
  permissions?: readonly string[] | null;
  plan?: Plano | string | null;
  role?: PapelUsuario | string | null;
}) {
  if (!canOpenPath(plan, path)) return false;

  const normalizedRole = normalizeRole(role);
  if (isAdministrativeRole(normalizedRole)) return true;
  if (!isOperationalRole(normalizedRole)) return false;

  // Áreas administrativas nunca são liberadas por uma permissão operacional antiga.
  if (isAdministrativePath(path)) return false;

  // Enquanto um módulo ainda lê documentos financeiros completos diretamente do
  // Firestore, ele não é liberado à equipe. A rota entra nesta lista somente
  // depois de ganhar projeção server-side sanitizada.
  if (!isOperationallySafePath(path)) return false;

  const requiredPermission = getPermissionForPath(path);

  // Para perfis operacionais adotamos deny-by-default: rota nova precisa ser
  // explicitamente classificada antes de aparecer para a equipe.
  if (!requiredPermission) return false;

  return (permissions || []).includes("*") || (permissions || []).includes(requiredPermission);
}
