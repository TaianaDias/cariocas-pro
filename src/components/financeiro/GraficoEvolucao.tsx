"use client";

import type { PontoEvolucao } from "../../services/financeiro.service";

type GraficoEvolucaoProps = {
  dados: PontoEvolucao[];
  loading: boolean;
};

export function GraficoEvolucao({ dados, loading }: GraficoEvolucaoProps) {
  if (loading) return <div className="financeiro-chart financeiro-chart--loading skeleton" />;
  if (!dados.length) return <div className="financeiro-chart financeiro-chart--empty">Sem dados para exibir</div>;

  const maxValor = Math.max(...dados.map((ponto) => Math.max(ponto.custo, ponto.faturamento)), 1);

  return (
    <section className="financeiro-chart">
      <header>
        <strong>Evolucao Custo x Faturamento</strong>
      </header>

      <div className="financeiro-bars">
        {dados.map((ponto) => (
          <div className="financeiro-bars__group" key={ponto.periodo}>
            <div className="financeiro-bars__columns">
              <span
                className="financeiro-bars__bar financeiro-bars__bar--cost"
                style={{ height: `${Math.max((ponto.custo / maxValor) * 100, 2)}%` }}
                title={`Custo: R$ ${ponto.custo.toFixed(2)}`}
              />
              <span
                className="financeiro-bars__bar financeiro-bars__bar--revenue"
                style={{ height: `${Math.max((ponto.faturamento / maxValor) * 100, 2)}%` }}
                title={`Faturamento: R$ ${ponto.faturamento.toFixed(2)}`}
              />
            </div>
            <small>{ponto.periodo}</small>
          </div>
        ))}
      </div>

      <footer className="financeiro-legend">
        <span><i className="financeiro-dot financeiro-dot--cost" /> Custo</span>
        <span><i className="financeiro-dot financeiro-dot--revenue" /> Faturamento</span>
      </footer>
    </section>
  );
}
