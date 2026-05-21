import type { ReactNode } from "react";

type DrawerProps = {
  children: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  side?: "left" | "right";
  title: string;
};

export function Drawer({ children, footer, open = true, side = "right", title }: DrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <aside className={`drawer drawer--${side}`} aria-label={title}>
      <header className="drawer__header">
        <h2>{title}</h2>
      </header>
      <div className="drawer__body">{children}</div>
      {footer ? <footer className="drawer__footer">{footer}</footer> : null}
    </aside>
  );
}
