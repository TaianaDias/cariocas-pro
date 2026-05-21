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

const STATUS_MAP: Record<StatusBadgeStatus, { label: string; cor: string; bg: string }> = {
  ativo: { label: "Ativo", cor: "var(--green-success)", bg: "rgba(34, 197, 94, 0.15)" },
  critical: { label: "Critico", cor: "var(--crimson)", bg: "rgba(220, 38, 38, 0.15)" },
  critico: { label: "Critico", cor: "var(--crimson)", bg: "rgba(220, 38, 38, 0.15)" },
  margem_baixa: { label: "Margem Baixa", cor: "var(--crimson)", bg: "rgba(220, 38, 38, 0.1)" },
  parado: { label: "Parado", cor: "var(--yellow-warn)", bg: "rgba(234, 179, 8, 0.15)" },
  pausado: { label: "Pausado", cor: "var(--text-soft)", bg: "rgba(107, 114, 128, 0.15)" },
  sem_ficha: { label: "Sem Ficha", cor: "var(--yellow-warn)", bg: "rgba(234, 179, 8, 0.1)" },
  success: { label: "OK", cor: "var(--green-success)", bg: "rgba(34, 197, 94, 0.15)" },
  warning: { label: "Atencao", cor: "var(--yellow-warn)", bg: "rgba(234, 179, 8, 0.15)" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status] || STATUS_MAP.pausado;

  return (
    <span
      style={{
        alignItems: "center",
        background: config.bg,
        borderRadius: 12,
        color: config.cor,
        display: "inline-flex",
        fontSize: 11,
        fontWeight: 700,
        gap: 4,
        padding: "2px 10px",
      }}
    >
      {config.label}
    </span>
  );
}
