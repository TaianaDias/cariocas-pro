import type { NavigationItem } from "../../config/navigation";
import { ModuleIcon } from "./ModuleIcon";

type ModuleCardProps = {
  item: NavigationItem;
};

export function ModuleCard({ item }: ModuleCardProps) {
  const content = (
    <>
      <span className="module-card__icon">
        <ModuleIcon name={item.icon} />
      </span>
      <span className="module-card__content">
        <strong>{item.label}</strong>
        {item.description ? <small>{item.description}</small> : null}
      </span>
      {item.planned ? <span className="module-card__status">Em breve</span> : <span className="module-card__arrow">→</span>}
    </>
  );

  if (item.planned) {
    return (
      <div className="module-card module-card--planned" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <a className="module-card" href={item.href}>
      {content}
    </a>
  );
}
