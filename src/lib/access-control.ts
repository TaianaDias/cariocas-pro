import { canOpenPath, type Plano } from "./plan";
import type { PapelUsuario, PermissaoFuncionario } from "../types";

export const employeePermissionOptions: { label: string; permission: PermissaoFuncionario; path: string; risk?: string }[] = [
  { label: "Dashboard", path: "/dashboard", permission: "dashboard.ver" },
  { label: "Estoque e Reposicao", path: "/estoque", permission: "estoque.ver" },
  { label: "Compras / Movimentacoes", path: "/compras", permission: "compras.ver" },
  { label: "Producao", path: "/producao", permission: "producao.ver" },
  { label: "Desperdicio", path: "/desperdicio", permission: "desperdicio.ver" },
  { label: "Relatorios", path: "/relatorios", permission: "relatorios.ver" },
];

const administrativeRoles: PapelUsuario[] = ["admin", "dono", "proprietario", "user"];
const operationalRoles: PapelUsuario[] = ["gerente", "funcionario"];
const administrativePaths = ["/precificacao", "/financeiro", "/fornecedores", "/funcionarios", "/configuracoes"];

export function normalizeRole(role?: string | null): PapelUsuario {
  if (role === "admin" || role === "dono" || role === "proprietario" || role === "gerente" || role === "funcionario") {
    return role;
  }

  // Mantemos "user" como administrativo por compatibilidade com contas antigas.
  // A migracao de papeis pode remover este fallback em uma etapa separada.
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

  // Areas administrativas nunca sao liberadas por uma permissao operacional antiga.
  if (isAdministrativePath(path)) return false;

  const requiredPermission = getPermissionForPath(path);

  // Para perfis operacionais adotamos deny-by-default: rota nova precisa ser
  // explicitamente classificada antes de aparecer para a equipe.
  if (!requiredPermission) return false;

  return (permissions || []).includes("*") || (permissions || []).includes(requiredPermission);
}
