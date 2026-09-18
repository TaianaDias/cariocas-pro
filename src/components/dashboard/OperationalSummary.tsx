type OperationalSummaryProps = {
  criticalItems: number;
  expiringItems: number;
  pendingReplenishment: number;
  suggestedPurchases: number;
  loading?: boolean;
};

const summaryItems = [
  { key: "criticalItems", label: "Itens críticos", helper: "Precisam de atenção no estoque", href: "/estoque" },
  { key: "pendingReplenishment", label: "Reposições pendentes", helper: "Itens sem saldo ou abaixo do necessário", href: "/reposicao" },
  { key: "expiringItems", label: "Próximos da validade", helper: "Produtos com vencimento próximo", href: "/relatorios/validades" },
  { key: "suggestedPurchases", label: "Compras sugeridas", helper: "Necessidades identificadas pela operação", href: "/compras" },
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
        <a
          className="operational-summary__card"
          href={item.href}
          key={item.key}
          aria-label={`${item.label}: abrir módulo relacionado`}
        >
          <span>{item.label}</span>
          <strong>{loading ? "—" : values[item.key]}</strong>
          <small>{item.helper}</small>
          <span className="operational-summary__arrow" aria-hidden="true">→</span>
        </a>
      ))}
    </section>
  );
}
