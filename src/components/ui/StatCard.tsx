import type { ReactNode } from "react";

type StatCardTone = "neutral" | "info" | "success" | "warning" | "danger";

type StatCardProps = {
  hint?: string;
  label: string;
  loading?: boolean;
  tone?: StatCardTone;
  value: ReactNode;
};

export function StatCard({ hint, label, loading = false, tone = "neutral", value }: StatCardProps) {
  return (
    <article className={`ui-stat-card ui-stat-card--${tone}`}>
      <span className="ui-stat-card__label">{label}</span>
      {loading ? <span className="ui-stat-card__skeleton" aria-label="Carregando indicador" /> : <strong className="ui-stat-card__value">{value}</strong>}
      {hint ? <small className="ui-stat-card__hint">{hint}</small> : null}
    </article>
  );
}
