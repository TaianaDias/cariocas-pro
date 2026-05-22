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
  return (
    <aside className="sidebar" aria-label="Navegacao principal">
      <a className="sidebar__brand" href="/dashboard" aria-label="Carioca's Pro">
        <span className="sidebar__brand-mark">CP</span>
        <span>Carioca's Pro</span>
      </a>

      <nav className="sidebar__nav" aria-label="Menu principal">
        {navigationItems.map((item) => (
          <a className={`sidebar__link ${item.premium ? "sidebar__link--premium" : ""}`.trim()} href={item.href} key={item.href}>
            <span className="sidebar__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="sidebar__label">{item.label}</span>
            {item.badge ? <span className="sidebar__badge">{item.badge}</span> : null}
          </a>
        ))}
      </nav>
    </aside>
  );
}
