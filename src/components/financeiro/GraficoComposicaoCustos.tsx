"use client";

import type { ComposicaoCusto } from "../../services/financeiro.service";

type GraficoComposicaoCustosProps = {
  dados: ComposicaoCusto[];
  loading: boolean;
};

export function GraficoComposicaoCustos({ dados, loading }: GraficoComposicaoCustosProps) {
  if (loading) return <div className="financeiro-chart financeiro-chart--loading skeleton" />;
  if (!dados.length) return <div className="financeiro-chart financeiro-chart--empty">Sem dados para exibir</div>;

  const total = dados.reduce((acc, item) => acc + item.valor, 0);
  const top5 = dados.slice(0, 5);
  const outros = dados.slice(5);
  const valorOutros = outros.reduce((acc, item) => acc + item.valor, 0);
  const items = valorOutros > 0
    ? [...top5, { categoria: "Outros", cor: "#6B7280", percentual: total > 0 ? Math.round((valorOutros / total) * 1000) / 10 : 0, valor: valorOutros }]
    : top5;

  return (
    <section className="financeiro-chart">
      <header>
        <strong>Composicao de Custos</strong>
      </header>

      <div className="financeiro-composition">
        {items.map((item) => (
          <div className="financeiro-composition__item" key={item.categoria}>
            <div>
              <span>{item.categoria}</span>
              <small>{item.percentual.toFixed(1)}% - R$ {item.valor.toFixed(2)}</small>
            </div>
            <span className="financeiro-composition__track">
              <i style={{ background: item.cor, width: `${Math.min(item.percentual, 100)}%` }} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
