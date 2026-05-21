import type { ReactNode } from "react";

type TitleProps = {
  eyebrow?: string;
  children: ReactNode;
};

export function Title({ eyebrow, children }: TitleProps) {
  return (
    <header className="title">
      {eyebrow ? <span className="title__eyebrow">{eyebrow}</span> : null}
      <h1>{children}</h1>
    </header>
  );
}
