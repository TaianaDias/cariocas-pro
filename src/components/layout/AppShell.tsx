"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { Spinner } from "../ui/Spinner";
import { canAccessAppPath } from "../../lib/access-control";
import { useAuth } from "../../hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, user, userProfile } = useAuth();
  const isPublicRoute = pathname === "/" || pathname === "/login" || pathname === "/cadastro" || pathname === "/planos" || pathname === "/auditoria";
  const canOpenCurrentPath = isPublicRoute || canAccessAppPath({
    path: pathname,
    permissions: userProfile?.permissoes || [],
    plan: userProfile?.plano || userProfile?.plan || "free",
    role: userProfile?.role || "user",
  });

  useEffect(() => {
    if (!loading && user && !canOpenCurrentPath) {
      router.replace("/dashboard");
    }
  }, [canOpenCurrentPath, loading, router, user]);

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

  if (!canOpenCurrentPath) {
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
          const enabled = canAccessAppPath({
            path: item.href,
            permissions: userProfile?.permissoes || [],
            plan: userProfile?.plano || userProfile?.plan || "free",
            role: userProfile?.role || "user",
          });
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
