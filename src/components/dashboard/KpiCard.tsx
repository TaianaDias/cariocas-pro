import type { ReactNode } from "react";

import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

type KpiCardProps = {
  icon?: ReactNode;
  loading?: boolean;
  title: string;
  value: string;
  variation: string;
};

export function KpiCard({ icon, loading = false, title, value, variation }: KpiCardProps) {
  const variationTone = variation.includes("-") || variation.includes("↓") ? "negative" : "positive";

  return (
    <Card>
      <div className="kpi-card">
        {loading ? (
          <Skeleton lines={3} />
        ) : (
          <>
            <span className="kpi-card__title">{title}</span>
            <div className="kpi-card__body">
              <strong className="kpi-card__value">{value}</strong>
              {icon ? (
                <span className="kpi-card__icon" aria-hidden="true">
                  {icon}
                </span>
              ) : null}
            </div>
            {variation ? (
              <span className={`kpi-card__variation kpi-card__variation--${variationTone}`}>
                {variation}
              </span>
            ) : (
              <span className="kpi-card__variation kpi-card__variation--neutral">Atual</span>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
