import type { NavigationSection } from "../../config/navigation";
import { ModuleCard } from "./ModuleCard";

type ModuleSectionProps = {
  section: NavigationSection;
};

export function ModuleSection({ section }: ModuleSectionProps) {
  return (
    <section className="module-section" aria-labelledby={`dashboard-section-${section.id}`}>
      <header className="module-section__header">
        <div>
          <span className="module-section__eyebrow">{section.adminOnly ? "Acesso restrito" : "Central de trabalho"}</span>
          <h2 id={`dashboard-section-${section.id}`}>{section.label}</h2>
        </div>
        <p>{section.description}</p>
      </header>

      <div className="module-grid">
        {section.items.map((item) => (
          <ModuleCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}
