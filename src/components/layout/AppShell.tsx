"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { useAuth } from "../../hooks/useAuth";
import { canAccessAppPath } from "../../lib/access-control";
import { AppLoading } from "./AppLoading";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [navigationOpen, setNavigationOpen] = useState(false);
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
    setNavigationOpen(false);
  }, [pathname]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return <AppLoading />;
  }

  if (!user || !canOpenCurrentPath) {
    return null;
  }

  return (
    <div className="app-shell">
      <Sidebar open={navigationOpen} onClose={() => setNavigationOpen(false)} />
      <button
        className={`sidebar-backdrop ${navigationOpen ? "is-visible" : ""}`.trim()}
        type="button"
        onClick={() => setNavigationOpen(false)}
        aria-label="Fechar navegação"
      />

      <div className="app-main">
        <Topbar onOpenNavigation={() => setNavigationOpen(true)} />
        <main className="app-content">
          <div className="app-content__container">{children}</div>
        </main>
      </div>
    </div>
  );
}
