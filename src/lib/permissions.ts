import type { PapelUsuario, PlanoSaas } from "../types";
import { isAdministrativeRole, normalizeRole } from "./access-control";

export type PrecificacaoPermission =
  | "precificacao.ver"
  | "precificacao.configurar"
  | "precificacao.verCustos"
  | "precificacao.recalcular"
  | "precificacao.aplicarPreco"
  | "precificacao.relatorio";

export function normalizePlan(plan?: string): PlanoSaas {
  if (plan === "essencial" || plan === "pro" || plan === "plus" || plan === "full") {
    return plan;
  }

  return "free";
}

export function canAccessPrecificacao(plan?: string, role?: string) {
  const normalizedPlan = normalizePlan(plan);
  const normalizedRole = normalizeRole(role);

  if (!isAdministrativeRole(normalizedRole)) return false;

  return normalizedPlan === "pro" || normalizedPlan === "plus" || normalizedPlan === "full";
}

export function canUsePrecificacaoCompleta(plan?: string, role?: string) {
  const normalizedPlan = normalizePlan(plan);
  const normalizedRole = normalizeRole(role);

  if (!isAdministrativeRole(normalizedRole)) return false;

  return normalizedPlan === "plus" || normalizedPlan === "full";
}

export function canUseFichaTecnicaSimples(plan?: string) {
  const normalizedPlan = normalizePlan(plan);
  return normalizedPlan === "pro" || normalizedPlan === "plus" || normalizedPlan === "full";
}

export function hasPrecificacaoPermission(permission: PrecificacaoPermission, plan?: string, role?: string) {
  const normalizedPlan = normalizePlan(plan);
  const normalizedRole = normalizeRole(role);

  if (!canAccessPrecificacao(normalizedPlan, normalizedRole)) return false;
  if (!isAdministrativeRole(normalizedRole)) return false;

  if (normalizedPlan === "plus" || normalizedPlan === "full") {
    return true;
  }

  return permission === "precificacao.ver";
}

export function canSeePrecificacaoMoney(plan?: string, role?: string) {
  return hasPrecificacaoPermission("precificacao.verCustos", plan, role);
}

export function isPrecificacaoAdministrativeRole(role?: PapelUsuario | string | null) {
  return isAdministrativeRole(role);
}
