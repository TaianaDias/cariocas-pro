"use client";

import { ActionButton } from "../../components/dashboard/ActionButton";
import { KpiCard } from "../../components/dashboard/KpiCard";
import { SmartCard } from "../../components/dashboard/SmartCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { Section } from "../../components/ui/Section";
import { Title } from "../../components/ui/Title";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function DashboardPage() {
  const {
    cmvForaIdeal,
    comprasRecomendadas,
    error,
    kpis,
    loading,
    previsaoRuptura,
    produtosVencer,
  } = useDashboardData();

  if (error) {
    return <EmptyState title="Erro ao carregar dashboard" description={error} />;
  }

  return (
    <div className="dashboard-page">
      <Title eyebrow="Operacao em tempo real">Dashboard Premium 2026</Title>

      <Section title="Indicadores">
        <div className="dashboard-kpi-grid">
          <KpiCard
            title="Custo do Dia"
            value={kpis ? `R$ ${kpis.custoDoDia.toFixed(2)}` : ""}
            variation={kpis ? `${kpis.variacaoCusto > 0 ? "↑" : "↓"} ${Math.abs(kpis.variacaoCusto)}%` : ""}
            loading={loading}
          />
          <KpiCard
            title="Desperdicio"
            value={kpis ? `${kpis.desperdicioPercentual.toFixed(1)}%` : ""}
            variation={
              kpis
                ? `${kpis.variacaoDesperdicio > 0 ? "↑" : "↓"} ${Math.abs(kpis.variacaoDesperdicio)}%`
                : ""
            }
            loading={loading}
          />
          <KpiCard
            title="Itens Criticos"
            value={kpis ? `${kpis.itensCriticos} itens` : ""}
            variation=""
            loading={loading}
          />
          <KpiCard
            title="Reposicao Pendente"
            value={kpis ? `${kpis.reposicaoPendente} pend.` : ""}
            variation=""
            loading={loading}
          />
        </div>
      </Section>

      <Section title="Cards inteligentes">
        <div className="dashboard-smart-grid">
          <SmartCard
            title="Produtos a vencer"
            items={produtosVencer.map((produto) => ({
              label: produto.insumo.nome,
              value: `${produto.diasRestantes} dias`,
              status: produto.diasRestantes <= 1 ? "critical" : "warning",
            }))}
            loading={loading}
          />
          <SmartCard
            title="Previsao de ruptura"
            items={previsaoRuptura.map((ruptura) => ({
              label: ruptura.insumo.nome,
              value: `${ruptura.probabilidade}% em ${ruptura.previsaoDias}d`,
              status: ruptura.probabilidade > 70 ? "critical" : "warning",
            }))}
            loading={loading}
          />
          <SmartCard
            title="Compras recomendadas"
            items={comprasRecomendadas.map((compra) => ({
              label: compra.insumo.nome,
              value: `${compra.quantidadeRecomendada} ${compra.insumo.unidadeCompra}`,
              status: "warning",
            }))}
            loading={loading}
          />
          <SmartCard
            title="CMV fora do ideal"
            items={cmvForaIdeal.map((cmv) => ({
              label: cmv.insumo.nome,
              value: `${cmv.variacao > 0 ? "+" : ""}${cmv.variacao.toFixed(1)}%`,
              status: cmv.variacao > 10 ? "critical" : "warning",
            }))}
            loading={loading}
          />
        </div>
      </Section>

      <Section title="Acoes rapidas">
        <div className="dashboard-actions-grid">
          <ActionButton label="Registrar Entrada" icon="+" onClick={() => undefined} />
          <ActionButton label="Registrar Saida" icon="-" onClick={() => undefined} />
          <ActionButton label="Importar XML" icon="XML" onClick={() => undefined} />
          <ActionButton label="Criar Etiquetas" icon="#" onClick={() => undefined} />
        </div>
      </Section>
    </div>
  );
}
