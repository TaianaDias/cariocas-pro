"use client";

import type { PontoEvolucao } from "../../services/financeiro.service";

type GraficoCmvProps = {
  dados: PontoEvolucao[];
  loading: boolean;
};

function getCmvColor(cmv: number) {
  if (cmv <= 30) return "var(--green-success)";
  if (cmv <= 40) return "var(--yellow-warn)";
  return "var(--crimson)";
}

export function GraficoCmv({ dados, loading }: GraficoCmvProps) {
  if (loading) return <div className="financeiro-chart financeiro-chart--compact financeiro-chart--loading skeleton" />;
  if (!dados.length) return <div className="financeiro-chart financeiro-chart--empty">Sem dados para exibir</div>;

  const maxCmv = Math.max(...dados.map((ponto) => ponto.cmv), 50);

  return (
    <section className="financeiro-chart financeiro-chart--compact">
      <header>
        <strong>Evolucao do CMV</strong>
        <span>Meta 30%</span>
      </header>

      <div className="financeiro-cmv">
        <span className="financeiro-cmv__target" style={{ top: `${Math.max(0, 100 - (30 / maxCmv) * 100)}%` }} />
        {dados.map((ponto) => (
          <div className="financeiro-cmv__group" key={ponto.periodo}>
            <small style={{ color: getCmvColor(ponto.cmv) }}>{ponto.cmv.toFixed(1)}%</small>
            <span
              className="financeiro-cmv__bar"
              style={{
                background: getCmvColor(ponto.cmv),
                height: `${Math.max((ponto.cmv / maxCmv) * 100, 2)}%`,
              }}
            />
            <em>{ponto.periodo}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
