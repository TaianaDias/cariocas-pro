"use client";

type KpiFinanceiroProps = {
  label: string;
  valor: string;
  variacao?: string;
  icone?: string;
  loading?: boolean;
  corValor?: string;
};

function getVariacaoCor(variacao?: string) {
  if (!variacao) return "var(--text-soft)";
  const valor = Number.parseFloat(variacao.replace(/[^0-9.,-]/g, "").replace(",", "."));
  if (valor > 0) return "var(--green-success)";
  if (valor < 0) return "var(--crimson)";
  return "var(--text-soft)";
}

export function KpiFinanceiro({ corValor, icone, label, loading, valor, variacao }: KpiFinanceiroProps) {
  if (loading) {
    return (
      <article className="financeiro-kpi financeiro-kpi--loading">
        <span className="skeleton" />
        <span className="skeleton" />
        <span className="skeleton" />
      </article>
    );
  }

  return (
    <article className="financeiro-kpi">
      <span className="financeiro-kpi__label">
        {icone ? <span aria-hidden="true">{icone}</span> : null}
        {label}
      </span>
      <strong style={{ color: corValor || "var(--text-base)" }}>{valor}</strong>
      {variacao ? <small style={{ color: getVariacaoCor(variacao) }}>{variacao}</small> : <small>Atual</small>}
    </article>
  );
}
