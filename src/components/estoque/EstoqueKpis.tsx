import { StatCard } from "../ui/StatCard";

type EstoqueKpisProps = {
  administrative: boolean;
  kpis: {
    abaixoMinimo: number;
    proxVencimento: number;
    semFornecedor: number;
    precisaEtiqueta: number;
    aumentoCusto: number;
    margemBaixa: number;
  };
  loading: boolean;
};

type KpiTone = "danger" | "warning" | "info";

export function EstoqueKpis({ administrative, kpis, loading }: EstoqueKpisProps) {
  const operationalItems: { hint: string; label: string; tone: KpiTone; value: number }[] = [
    { label: "Abaixo do mínimo", value: kpis.abaixoMinimo, tone: "danger", hint: "Requer reposição" },
    { label: "Próx. vencimento", value: kpis.proxVencimento, tone: "warning", hint: "Validade próxima" },
    { label: "Sem fornecedor", value: kpis.semFornecedor, tone: "warning", hint: "Cadastro incompleto" },
    { label: "Precisa etiqueta", value: kpis.precisaEtiqueta, tone: "info", hint: "Ação operacional" },
  ];
  const administrativeItems: { hint: string; label: string; tone: KpiTone; value: number }[] = [
    { label: "Aumento de custo", value: kpis.aumentoCusto, tone: "warning", hint: "Custo alterado" },
    { label: "Margem baixa", value: kpis.margemBaixa, tone: "danger", hint: "Revisar precificação" },
  ];
  const items = administrative ? [...operationalItems, ...administrativeItems] : operationalItems;

  return (
    <section className="estoque-kpis" aria-label="Indicadores de estoque">
      {items.map((item) => (
        <StatCard
          hint={item.value === 0 ? "Tudo certo" : item.hint}
          key={item.label}
          label={item.label}
          loading={loading}
          tone={item.value === 0 ? "neutral" : item.tone}
          value={item.value}
        />
      ))}
    </section>
  );
}
