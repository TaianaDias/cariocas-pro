"use client";

import { useState } from "react";

import { FiltroPeriodo } from "../../components/financeiro/FiltroPeriodo";
import { FinanceiroHeader } from "../../components/financeiro/FinanceiroHeader";
import { GraficoCmv } from "../../components/financeiro/GraficoCmv";
import { GraficoComposicaoCustos } from "../../components/financeiro/GraficoComposicaoCustos";
import { GraficoEvolucao } from "../../components/financeiro/GraficoEvolucao";
import { PainelKpisFinanceiro } from "../../components/financeiro/PainelKpisFinanceiro";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { useFinanceiro } from "../../hooks/useFinanceiro";

export default function FinanceiroPage() {
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [dataFim, setDataFim] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59));
  const { composicao, error, evolucao, kpis, loading, refetch } = useFinanceiro();

  function handleRefetch() {
    refetch(dataInicio, dataFim);
  }

  if (error) {
    return (
      <EmptyState
        title="Erro ao carregar financeiro"
        description={error}
        action={<Button onClick={handleRefetch}>Tentar novamente</Button>}
      />
    );
  }

  return (
    <main className="financeiro-page">
      <FinanceiroHeader />
      <FiltroPeriodo
        dataFim={dataFim}
        dataInicio={dataInicio}
        onAplicar={handleRefetch}
        onChangeFim={setDataFim}
        onChangeInicio={setDataInicio}
      />

      <PainelKpisFinanceiro kpis={kpis} loading={loading} />

      <section className="financeiro-grid financeiro-grid--charts">
        <Card className="financeiro-card">
          <GraficoEvolucao dados={evolucao} loading={loading} />
        </Card>
        <Card className="financeiro-card">
          <GraficoCmv dados={evolucao} loading={loading} />
        </Card>
      </section>

      <section className="financeiro-grid financeiro-grid--summary">
        <Card className="financeiro-card">
          <GraficoComposicaoCustos dados={composicao} loading={loading} />
        </Card>
        <Card className="financeiro-card financeiro-summary">
          <strong>Resumo do Periodo</strong>
          {loading ? (
            <div className="skeleton financeiro-summary__loading" />
          ) : (
            <div className="financeiro-summary__list">
              <ResumoItem label="Custo total" value={`R$ ${(kpis?.custoTotal || 0).toFixed(2)}`} />
              <ResumoItem label="CMV medio" value={`${(kpis?.cmvMedio || 0).toFixed(1)}%`} tone={(kpis?.cmvMedio || 0) <= 30 ? "success" : "danger"} />
              <ResumoItem label="Margem media" value={`${(kpis?.margemMedia || 0).toFixed(1)}%`} tone={(kpis?.margemMedia || 0) >= 40 ? "success" : "warning"} />
              <ResumoItem label="Desperdicio" value={`${(kpis?.percentualDesperdicio || 0).toFixed(1)}%`} tone={(kpis?.percentualDesperdicio || 0) > 5 ? "danger" : "success"} />
              <ResumoItem label="Desperdicio em R$" value={`R$ ${(kpis?.custoDesperdicio || 0).toFixed(2)}`} />
              <ResumoItem label="Ticket medio" value={`R$ ${(kpis?.ticketMedio || 0).toFixed(2)}`} strong />
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}

function ResumoItem({ label, strong = false, tone, value }: { label: string; value: string; tone?: "success" | "warning" | "danger"; strong?: boolean }) {
  return (
    <div className={`financeiro-summary__item ${strong ? "financeiro-summary__item--strong" : ""}`.trim()}>
      <span>{label}</span>
      <b className={tone ? `financeiro-tone financeiro-tone--${tone}` : ""}>{value}</b>
    </div>
  );
}
