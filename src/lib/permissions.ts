import type { PapelUsuario, PlanoSaas } from "../types";

export type PrecificacaoPermission =
  | "precificacao.ver"
  | "precificacao.configurar"
  | "precificacao.verCustos"
  | "precificacao.recalcular"
  | "precificacao.aplicarPreco"
  | "precificacao.relatorio";

const fullAccessRoles: PapelUsuario[] = ["admin", "dono", "proprietario"];
const financialPermissions: PrecificacaoPermission[] = [
  "precificacao.configurar",
  "precificacao.verCustos",
  "precificacao.recalcular",
  "precificacao.aplicarPreco",
  "precificacao.relatorio",
];

export function normalizePlan(plan?: string): PlanoSaas {
  if (plan === "essencial" || plan === "pro" || plan === "plus" || plan === "full") {
    return plan;
  }

  return "free";
}

export function normalizeRole(role?: string): PapelUsuario {
  if (role === "admin" || role === "dono" || role === "proprietario" || role === "gerente" || role === "funcionario") {
    return role;
  }

  return "user";
}

export function canAccessPrecificacao(plan?: string, role?: string) {
  const normalizedPlan = normalizePlan(plan);

  return normalizedPlan === "pro" || normalizedPlan === "plus" || normalizedPlan === "full";
}

export function canUsePrecificacaoCompleta(plan?: string, role?: string) {
  const normalizedPlan = normalizePlan(plan);
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "funcionario") {
    return false;
  }

  return normalizedPlan === "plus" || normalizedPlan === "full";
}

export function canUseFichaTecnicaSimples(plan?: string) {
  const normalizedPlan = normalizePlan(plan);
  return normalizedPlan === "pro" || normalizedPlan === "plus" || normalizedPlan === "full";
}

export function hasPrecificacaoPermission(permission: PrecificacaoPermission, plan?: string, role?: string) {
  const normalizedPlan = normalizePlan(plan);
  const normalizedRole = normalizeRole(role);

  if (!canAccessPrecificacao(normalizedPlan, normalizedRole)) {
    return false;
  }

  if (normalizedRole === "funcionario" && financialPermissions.includes(permission)) {
    return false;
  }

  if ((normalizedPlan === "plus" || normalizedPlan === "full") && normalizedRole !== "funcionario") {
    return true;
  }

  return permission === "precificacao.ver";
}

export function canSeePrecificacaoMoney(plan?: string, role?: string) {
  return hasPrecificacaoPermission("precificacao.verCustos", plan, role);
}
