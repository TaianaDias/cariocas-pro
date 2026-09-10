"use client";

type StatusBadgeStatus =
  | "critical"
  | "warning"
  | "success"
  | "critico"
  | "parado"
  | "margem_baixa"
  | "sem_ficha"
  | "ativo"
  | "pausado";

type StatusBadgeProps = {
  status: StatusBadgeStatus;
};

type StatusTone = "danger" | "warning" | "success" | "neutral";

const STATUS_MAP: Record<StatusBadgeStatus, { label: string; tone: StatusTone }> = {
  ativo: { label: "Ativo", tone: "success" },
  critical: { label: "Crítico", tone: "danger" },
  critico: { label: "Crítico", tone: "danger" },
  margem_baixa: { label: "Margem baixa", tone: "danger" },
  parado: { label: "Parado", tone: "warning" },
  pausado: { label: "Pausado", tone: "neutral" },
  sem_ficha: { label: "Sem ficha", tone: "warning" },
  success: { label: "OK", tone: "success" },
  warning: { label: "Atenção", tone: "warning" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status] || STATUS_MAP.pausado;
  return <span className={`estoque-status-badge estoque-status-badge--${config.tone}`}>{config.label}</span>;
}
