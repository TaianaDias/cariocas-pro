import { canOpenPath, getRequiredPlanForPath, planCatalog } from "../../lib/plan";
import { useAuth } from "../../hooks/useAuth";

const navigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: "D" },
  { label: "Estoque", href: "/estoque", icon: "E" },
  { label: "Compras", href: "/compras", icon: "C" },
  { label: "Producao", href: "/producao", icon: "P" },
  { label: "Desperdicio", href: "/desperdicio", icon: "D" },
  { label: "Fornecedores", href: "/fornecedores", icon: "F" },
  { label: "Funcionarios", href: "/funcionarios", icon: "F" },
  { label: "Financeiro", href: "/financeiro", icon: "$" },
  { label: "Precificacao Inteligente", href: "/precificacao", icon: "P+", badge: "PLUS", premium: true },
  { label: "Relatorios", href: "/relatorios", icon: "R" },
  { label: "Configuracoes", href: "/configuracoes", icon: "C" },
  { label: "IA Carioquinha", href: "/configuracoes/carioquinha", icon: "IA" },
  { label: "WhatsApp", href: "/configuracoes/whatsapp", icon: "W" },
];

export function Sidebar() {
  const { userProfile } = useAuth();
  const planoAtual = userProfile?.plano || userProfile?.plan || "free";

  return (
    <aside className="sidebar" aria-label="Navegacao principal">
      <a className="sidebar__brand" href="/dashboard" aria-label="Carioca's Pro">
        <span className="sidebar__brand-mark">CP</span>
        <span>Carioca's Pro</span>
      </a>

      <nav className="sidebar__nav" aria-label="Menu principal">
        {navigationItems.map((item) => {
          const liberado = canOpenPath(planoAtual, item.href);
          const requiredPlan = getRequiredPlanForPath(item.href);

          return (
          <a
            className={`sidebar__link ${item.premium ? "sidebar__link--premium" : ""} ${!liberado ? "sidebar__link--locked" : ""}`.trim()}
            href={liberado ? item.href : "/dashboard"}
            key={item.href}
            title={liberado ? item.label : `Disponivel no plano ${planCatalog[requiredPlan].name}`}
          >
            <span className="sidebar__icon" aria-hidden="true">
              {liberado ? item.icon : "L"}
            </span>
            <span className="sidebar__label">{item.label}</span>
            {item.badge ? <span className="sidebar__badge">{item.badge}</span> : null}
            {!liberado ? <span className="sidebar__badge">{planCatalog[requiredPlan].name}</span> : null}
          </a>
          );
        })}
      </nav>
    </aside>
  );
}
