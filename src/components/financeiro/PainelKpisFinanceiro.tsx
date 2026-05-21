"use client";

import type { KpisFinanceiro } from "../../services/financeiro.service";
import { KpiFinanceiro } from "./KpiFinanceiro";

type PainelKpisProps = {
  kpis: KpisFinanceiro | null;
  loading: boolean;
};

function formatCurrency(valor: number) {
  return valor.toLocaleString("pt-BR", { currency: "BRL", style: "currency" });
}

export function PainelKpisFinanceiro({ kpis, loading }: PainelKpisProps) {
  return (
    <section className="financeiro-kpi-grid">
      <KpiFinanceiro
        corValor={kpis && kpis.variacaoCusto > 0 ? "var(--crimson)" : undefined}
        icone="$"
        label="Custo Total do Estoque"
        loading={loading}
        valor={kpis ? formatCurrency(kpis.custoTotal) : ""}
        variacao={kpis ? `${kpis.variacaoCusto > 0 ? "+" : ""}${kpis.variacaoCusto.toFixed(1)}%` : ""}
      />
      <KpiFinanceiro
        corValor="var(--green-success)"
        icone="FT"
        label="Faturamento Estimado"
        loading={loading}
        valor={kpis ? formatCurrency(kpis.faturamentoEstimado) : ""}
      />
      <KpiFinanceiro
        corValor={kpis && kpis.margemMedia >= 40 ? "var(--green-success)" : "var(--yellow-warn)"}
        icone="MG"
        label="Margem Media"
        loading={loading}
        valor={kpis ? `${kpis.margemMedia.toFixed(1)}%` : ""}
        variacao={kpis ? `${kpis.variacaoMargem > 0 ? "+" : ""}${kpis.variacaoMargem.toFixed(1)}%` : ""}
      />
      <KpiFinanceiro
        corValor={kpis && kpis.cmvMedio <= 30 ? "var(--green-success)" : kpis && kpis.cmvMedio <= 40 ? "var(--yellow-warn)" : "var(--crimson)"}
        icone="CMV"
        label="CMV Medio"
        loading={loading}
        valor={kpis ? `${kpis.cmvMedio.toFixed(1)}%` : ""}
      />
      <KpiFinanceiro
        corValor={kpis && kpis.percentualDesperdicio > 5 ? "var(--crimson)" : "var(--green-success)"}
        icone="DP"
        label="Desperdicio"
        loading={loading}
        valor={kpis ? formatCurrency(kpis.custoDesperdicio) : ""}
        variacao={kpis ? `${kpis.percentualDesperdicio.toFixed(1)}% do custo` : ""}
      />
      <KpiFinanceiro
        icone="TK"
        label="Ticket Medio"
        loading={loading}
        valor={kpis ? formatCurrency(kpis.ticketMedio) : ""}
      />
    </section>
  );
}
