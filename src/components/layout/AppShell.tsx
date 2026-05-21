"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Spinner } from "../ui/Spinner";
import { useAuth } from "../../hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { loading, user } = useAuth();
  const isPublicRoute = pathname === "/" || pathname === "/login" || pathname === "/cadastro";

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
        <a href="/dashboard">Dashboard</a>
        <a href="/estoque">Estoque</a>
        <a href="/compras">Compras</a>
        <a href="/relatorios">Relatorios</a>
      </nav>
    </div>
  );
}
