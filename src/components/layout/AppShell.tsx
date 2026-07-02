"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const { loading, user, userProfile } = useAuth();
  const isPublicRoute = pathname === "/" || pathname === "/login" || pathname === "/cadastro" || pathname === "/planos" || pathname === "/auditoria";
  const accessContext = {
    permissions: userProfile?.permissoes || [],
    plan: userProfile?.plano || userProfile?.plan || "free",
    role: userProfile?.role || "user",
  };
  const canOpenCurrentPath = isPublicRoute || canAccessAppPath({ path: pathname, ...accessContext });

  useEffect(() => {
    if (!loading && user && !canOpenCurrentPath) {
      router.replace("/dashboard");
    }
  }, [canOpenCurrentPath, loading, router, user]);

  useEffect(() => {
    setMobileMoreOpen(false);
  }, [pathname]);

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

  const primaryMobileItems = [
    { href: "/dashboard", icon: "D", label: "Dashboard" },
    { href: "/estoque", icon: "E", label: "Estoque" },
    { href: "/compras", icon: "C", label: "Compras" },
    { href: "/producao", icon: "P", label: "Producao" },
  ];
  const secondaryMobileItems = [
    { href: "/desperdicio", icon: "D", label: "Desperdicio" },
    { href: "/fornecedores", icon: "F", label: "Fornecedores" },
    { href: "/funcionarios", icon: "F", label: "Funcionarios" },
    { href: "/financeiro", icon: "$", label: "Financeiro" },
    { href: "/precificacao", icon: "P+", label: "Precificacao" },
    { href: "/relatorios", icon: "R", label: "Relatorios" },
    { href: "/configuracoes", icon: "C", label: "Configuracoes" },
    { href: "/configuracoes/carioquinha", icon: "IA", label: "IA Carioquinha" },
    { href: "/configuracoes/whatsapp", icon: "W", label: "WhatsApp" },
  ];

  function canOpen(path: string) {
    return canAccessAppPath({ path, ...accessContext });
  }

  function isActive(path: string) {
    return pathname === path || pathname.startsWith(`${path}/`);
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

      {mobileMoreOpen ? (
        <div className="mobile-more" role="dialog" aria-label="Mais modulos">
          <div className="mobile-more__panel">
            <header>
              <strong>Mais modulos</strong>
              <button type="button" onClick={() => setMobileMoreOpen(false)} aria-label="Fechar menu mobile">
                Fechar
              </button>
            </header>
            <div className="mobile-more__grid">
              {secondaryMobileItems.map((item) => {
                const enabled = canOpen(item.href);
                return (
                  <a
                    className={`${!enabled ? "is-locked" : ""} ${isActive(item.href) ? "is-active" : ""}`.trim()}
                    href={enabled ? item.href : "/dashboard"}
                    key={item.href}
                  >
                    <span>{enabled ? item.icon : "L"}</span>
                    <b>{enabled ? item.label : "Bloqueado"}</b>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="mobile-dock" aria-label="Navegacao mobile">
        {primaryMobileItems.map((item) => {
          const enabled = canOpen(item.href);
          return (
            <a
              className={`${!enabled ? "is-locked" : ""} ${isActive(item.href) ? "is-active" : ""}`.trim()}
              href={enabled ? item.href : "/dashboard"}
              key={item.href}
            >
              <span>{enabled ? item.icon : "L"}</span>
              <b>{enabled ? item.label : "Bloqueado"}</b>
            </a>
          );
        })}
        <button
          className={mobileMoreOpen ? "is-active" : ""}
          type="button"
          onClick={() => setMobileMoreOpen((current) => !current)}
          aria-expanded={mobileMoreOpen}
          aria-label="Abrir mais modulos"
        >
          <span>+</span>
          <b>Mais</b>
        </button>
      </nav>
    </div>
  );
}
