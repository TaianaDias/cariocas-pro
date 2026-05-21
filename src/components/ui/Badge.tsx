import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export function Badge({ children, className = "", tone = "neutral" }: BadgeProps) {
  return <span className={`badge badge--${tone} ${className}`.trim()}>{children}</span>;
}
