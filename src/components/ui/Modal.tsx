import type { ReactNode } from "react";

type ModalProps = {
  children: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  title: string;
};

export function Modal({ children, footer, open = true, title }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal__header">
          <h2 id="modal-title">{title}</h2>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
