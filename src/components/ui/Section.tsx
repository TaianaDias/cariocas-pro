import type { ReactNode } from "react";

type SectionProps = {
  title?: string;
  children: ReactNode;
};

export function Section({ title, children }: SectionProps) {
  return (
    <section className="section">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
