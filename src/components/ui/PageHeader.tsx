import type { ReactNode } from "react";

type PageHeaderProps = {
  actions?: ReactNode;
  children?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
};

export function PageHeader({ actions, children, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header__top">
        <div className="ui-page-header__copy">
          {eyebrow ? <span className="ui-page-header__eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
      </div>
      {children ? <div className="ui-page-header__tools">{children}</div> : null}
    </header>
  );
}
