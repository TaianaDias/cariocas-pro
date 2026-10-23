import type { Insumo } from "../types";

export function precisaoCusto(value: number) {
  return Math.round((value + Number.EPSILON) * 1e8) / 1e8;
}

export function unidadeCanonica(value: string) {
  const unit = value.trim().toUpperCase();
  return ({ UND: "UN", UNID: "UN", UNIDADE: "UN", PORÇÃO: "PORCAO", LT: "L" } as Record<string, string>)[unit] || unit;
}

// Somente conversões dimensionais conhecidas. Embalagens exigem fator explícito.
export function converterUnidade(quantidade: number, origem: string, destino: string): number | null {
  const from = unidadeCanonica(origem);
  const to = unidadeCanonica(destino);
  if (!Number.isFinite(quantidade) || quantidade < 0 || !from || !to) return null;
  if (from === to) return quantidade;
  const dimensions: Record<string, [string, number]> = { KG: ["massa", 1000], G: ["massa", 1], L: ["volume", 1000], ML: ["volume", 1] };
  if (!dimensions[from] || !dimensions[to] || dimensions[from][0] !== dimensions[to][0]) return null;
  return quantidade * dimensions[from][1] / dimensions[to][1];
}

export type InsumoCusto = Pick<Insumo,
  "conversao" | "fatorConversao" | "custoCompra" | "custoManualTravado" | "custoUnitario" |
  "custoUnitarioUso" | "metodoCusto" | "custoReferencia" | "unidadeCompra" | "unidadeUso">;

export function resolverCustoInsumo(insumo: Partial<InsumoCusto>) {
  const referencia = insumo.custoReferencia;
  const fonte = referencia?.origem || "legado_sem_origem_confirmada";
  const informadoEm = referencia?.informadoEm || null;
  const pendente = (motivo: string) => ({ valor: null, fonte, informadoEm, motivo });
  const fator = Number(insumo.fatorConversao ?? insumo.conversao);
  if (!Number.isFinite(fator) || fator <= 0) return pendente("Conversão de compra para uso ausente ou inválida.");
  const from = unidadeCanonica(insumo.unidadeCompra || "");
  const to = unidadeCanonica(insumo.unidadeUso || "");
  if (!from || !to) return pendente("Unidades de compra e utilização precisam ser informadas.");
  const fisicas = ["KG", "G", "L", "ML"];
  if ((fisicas.includes(from) && fisicas.includes(to)) || from === to) {
    const esperado = converterUnidade(1, from, to);
    if (esperado === null || Math.abs(esperado - fator) > 1e-8) return pendente("Conversão incompatível com as unidades informadas.");
  }
  if (referencia) {
    const valor = referencia.valorCompra;
    if (valor === null || !Number.isFinite(valor) || valor < 0) return pendente("Custo de referência ainda não informado.");
    return { valor: precisaoCusto(valor / fator), fonte, informadoEm, motivo: null };
  }
  // Zero legado não informa se houve gratuidade ou dado ausente; exige confirmação.
  const legado = insumo.metodoCusto === "manual_travado"
    ? Number(insumo.custoManualTravado ?? insumo.custoUnitario)
    : Number(insumo.custoUnitarioUso ?? (Number(insumo.custoCompra) / fator));
  if (!Number.isFinite(legado) || legado <= 0) return pendente("Custo ausente ou zero legado sem confirmação.");
  return { valor: precisaoCusto(legado), fonte, informadoEm, motivo: null };
}
