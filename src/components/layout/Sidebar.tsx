"use client";

import { usePathname } from "next/navigation";

import { navigationSections, isAdministrativeRole } from "../../config/navigation";
import { useAuth } from "../../hooks/useAuth";
import { canAccessAppPath } from "../../lib/access-control";
import { ModuleIcon } from "../dashboard/ModuleIcon";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const plan = userProfile?.plano || userProfile?.plan || "free";
  const role = userProfile?.role || "user";
  const permissions = userProfile?.permissoes || [];

  function canOpen(path: string) {
    return canAccessAppPath({ path, permissions, plan, role });
  }

  return (
    <aside className={`sidebar ${open ? "is-open" : ""}`.trim()} aria-label="Navegação principal">
      <div className="sidebar__header">
        <a className="sidebar__brand" href="/dashboard" onClick={onClose} aria-label="Carioca's Pro">
          <span className="sidebar__brand-mark">CP</span>
          <span className="sidebar__brand-copy">
            <strong>Carioca&apos;s Pro</strong>
            <small>Central de operação</small>
          </span>
        </a>
        <button className="sidebar__close" type="button" onClick={onClose} aria-label="Fechar navegação">
          ×
        </button>
      </div>

      <nav className="sidebar__nav" aria-label="Menu principal">
        {navigationSections.map((section) => {
          if (section.adminOnly && !isAdministrativeRole(role)) return null;

          const items = section.items.filter(
            (item) => item.showInSidebar && !item.planned && canOpen(item.href),
          );

          if (!items.length) return null;

          return (
            <section className="sidebar__section" key={section.id}>
              <span className="sidebar__section-label">{section.label}</span>
              <div className="sidebar__section-links">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <a
                      className={`sidebar__link ${active ? "is-active" : ""}`.trim()}
                      href={item.href}
                      key={item.id}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="sidebar__icon"><ModuleIcon name={item.icon} /></span>
                      <span className="sidebar__label">{item.label}</span>
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
