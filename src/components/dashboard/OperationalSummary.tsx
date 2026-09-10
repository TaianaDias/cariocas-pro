type OperationalSummaryProps = {
  criticalItems: number;
  expiringItems: number;
  pendingReplenishment: number;
  suggestedPurchases: number;
  loading?: boolean;
};

const summaryItems = [
  { key: "criticalItems", label: "Itens críticos", helper: "Precisam de atenção no estoque" },
  { key: "pendingReplenishment", label: "Reposições pendentes", helper: "Itens sem saldo ou abaixo do necessário" },
  { key: "expiringItems", label: "Próximos da validade", helper: "Produtos com vencimento próximo" },
  { key: "suggestedPurchases", label: "Compras sugeridas", helper: "Necessidades identificadas pela operação" },
] as const;

export function OperationalSummary({
  criticalItems,
  expiringItems,
  pendingReplenishment,
  suggestedPurchases,
  loading = false,
}: OperationalSummaryProps) {
  const values = { criticalItems, expiringItems, pendingReplenishment, suggestedPurchases };

  return (
    <section className="operational-summary" aria-label="Resumo operacional">
      {summaryItems.map((item) => (
        <article className="operational-summary__card" key={item.key}>
          <span>{item.label}</span>
          <strong>{loading ? "—" : values[item.key]}</strong>
          <small>{item.helper}</small>
        </article>
      ))}
    </section>
  );
}
