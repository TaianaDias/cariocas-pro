import { canOpenPath, type Plano } from "./plan";
import type { PapelUsuario, PermissaoFuncionario } from "../types";

export const employeePermissionOptions: { label: string; permission: PermissaoFuncionario; path: string; risk?: string }[] = [
  { label: "Dashboard", path: "/dashboard", permission: "dashboard.ver" },
  { label: "Estoque", path: "/estoque", permission: "estoque.ver" },
  { label: "Compras", path: "/compras", permission: "compras.ver" },
  { label: "Producao", path: "/producao", permission: "producao.ver" },
  { label: "Desperdicio", path: "/desperdicio", permission: "desperdicio.ver" },
  { label: "Fornecedores", path: "/fornecedores", permission: "fornecedores.ver" },
  { label: "Funcionarios", path: "/funcionarios", permission: "funcionarios.gerenciar", risk: "Gerencia equipe e acessos" },
  { label: "Financeiro", path: "/financeiro", permission: "financeiro.ver", risk: "Dados sensiveis" },
  { label: "Precificacao", path: "/precificacao", permission: "precificacao.ver", risk: "Custos e margens" },
  { label: "Relatorios", path: "/relatorios", permission: "relatorios.ver" },
  { label: "Configuracoes", path: "/configuracoes", permission: "configuracoes.ver" },
  { label: "IA Carioquinha", path: "/configuracoes/carioquinha", permission: "ia.ver" },
  { label: "WhatsApp", path: "/configuracoes/whatsapp", permission: "whatsapp.ver" },
];

const unrestrictedRoles: PapelUsuario[] = ["admin", "dono", "proprietario", "user"];
const restrictedRoles: PapelUsuario[] = ["gerente", "funcionario"];

export function normalizeRole(role?: string | null): PapelUsuario {
  if (role === "admin" || role === "dono" || role === "proprietario" || role === "gerente" || role === "funcionario") {
    return role;
  }

  return "user";
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
  if (unrestrictedRoles.includes(normalizedRole)) return true;
  if (!restrictedRoles.includes(normalizedRole)) return false;

  const requiredPermission = getPermissionForPath(path);
  if (!requiredPermission) return true;

  return (permissions || []).includes(requiredPermission);
}
