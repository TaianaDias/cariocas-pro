"use client";

type BadgeAlertaProps = {
  count: number;
};

export function BadgeAlerta({ count }: BadgeAlertaProps) {
  if (count <= 0) return null;

  return <span className="alertas-badge">{count > 99 ? "99+" : count}</span>;
}
