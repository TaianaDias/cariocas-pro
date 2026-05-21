import { Skeleton } from "../ui/Skeleton";

type EstoqueKpisProps = {
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

export function EstoqueKpis({ kpis, loading }: EstoqueKpisProps) {
  const items = [
    { label: "Abaixo do minimo", value: kpis.abaixoMinimo, tone: "critical" },
    { label: "Prox. vencimento", value: kpis.proxVencimento, tone: "warning" },
    { label: "Sem fornecedor", value: kpis.semFornecedor, tone: "critical" },
    { label: "Precisa etiqueta", value: kpis.precisaEtiqueta, tone: "warning" },
    { label: "Aumento de custo", value: kpis.aumentoCusto, tone: "warning" },
    { label: "Margem baixa", value: kpis.margemBaixa, tone: "critical" },
  ];
  const tudoOk = items.every((item) => item.value === 0);

  return (
    <section className="estoque-kpis" aria-label="Indicadores de estoque">
      {loading
        ? Array.from({ length: 6 }).map((_, index) => (
            <article className="estoque-kpi" key={index}>
              <Skeleton lines={2} />
            </article>
          ))
        : items.map((kpi) => (
        <article className={`estoque-kpi estoque-kpi--${tudoOk ? "success" : kpi.tone}`} key={kpi.label}>
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
          {tudoOk ? <em>Tudo ok</em> : null}
        </article>
          ))}
    </section>
  );
}
