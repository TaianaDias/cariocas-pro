import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

type KpiCardProps = {
  href?: string;
  icon?: ReactNode;
  loading?: boolean;
  title: string;
  value: string;
  variation: string;
};

export function KpiCard({ href, icon, loading = false, title, value, variation }: KpiCardProps) {
  const variationTone = variation.includes("-") ? "negative" : "positive";
  const content = (
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
            <span className="kpi-card__variation kpi-card__variation--neutral">{href ? "Ver itens" : "Atual"}</span>
          )}
        </>
      )}
    </div>
  );

  if (href && !loading) {
    return (
      <Link className="card dashboard-kpi-link" href={href}>
        {content}
      </Link>
    );
  }

  return <Card>{content}</Card>;
}
