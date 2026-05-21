import type { ReactNode } from "react";

type ActionButtonProps = {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
};

export function ActionButton({ icon, label, onClick }: ActionButtonProps) {
  return (
    <button className="action-button" type="button" onClick={onClick}>
      <span className="action-button__icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
