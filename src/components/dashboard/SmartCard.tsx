import type { ReactNode } from "react";

import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

type SmartCardItem = {
  label: string;
  status?: "critical" | "warning" | "success";
  value: string;
};

type SmartCardProps = {
  icon?: ReactNode;
  title: string;
  items: SmartCardItem[];
  loading?: boolean;
};

export function SmartCard({ icon, items, loading = false, title }: SmartCardProps) {
  return (
    <Card>
      <div className="smart-card">
        <header className="smart-card__header">
          <h3>{title}</h3>
          {icon ? <span aria-hidden="true">{icon}</span> : null}
        </header>

        {loading ? (
          <Skeleton lines={4} />
        ) : items.length > 0 ? (
          <ul className="smart-card__list">
            {items.map((item) => (
              <li key={`${item.label}-${item.value}`}>
                <span>{item.label}</span>
                <strong className={item.status ? `smart-card__value--${item.status}` : undefined}>
                  {item.value}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="smart-card__empty">Nenhum item pendente</p>
        )}
      </div>
    </Card>
  );
}
