"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Spinner } from "../ui/Spinner";
import { canOpenPath } from "../../lib/plan";
import { useAuth } from "../../hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { loading, user, userProfile } = useAuth();
  const isPublicRoute = pathname === "/" || pathname === "/login" || pathname === "/cadastro" || pathname === "/planos" || pathname === "/auditoria";

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <main className="auth-splash">
        <strong>CARIOCA&apos;S PRO</strong>
        <Spinner label="Carregando sessao" />
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <Topbar />

        <main className="app-content">
          <div className="app-content__container">{children}</div>
        </main>
      </div>

      <nav className="mobile-dock" aria-label="Navegacao mobile">
        {[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/estoque", label: "Estoque" },
          { href: "/compras", label: "Compras" },
          { href: "/precificacao", label: "Precificacao" },
          { href: "/relatorios", label: "Relatorios" },
        ].map((item) => {
          const enabled = canOpenPath(userProfile?.plano || userProfile?.plan || "free", item.href);
          return (
            <a className={!enabled ? "is-locked" : ""} href={enabled ? item.href : "/dashboard"} key={item.href}>
              {enabled ? item.label : "Bloqueado"}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
