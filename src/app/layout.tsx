import type { Viewport } from "next";
import type { ReactNode } from "react";

import "../styles/tokens.css";
import "../styles/theme.css";
import "../styles/global.css";
import "../styles/layout.css";
import "../styles/loading.css";
import "../styles/components.css";
import "../styles/utilities.css";
import "../styles/dashboard.css";
import "../styles/planos.css";
import "../styles/estoque.css";
import "../styles/precificacao.css";
import "../styles/operacional.css";
import "../styles/carioquinha.css";
import "../styles/auth.css";
import "../styles/auditoria.css";

import { AppShell } from "../components/layout/AppShell";
import { AuthProvider } from "../contexts/AuthContext";

export const metadata = {
  title: "Carioca's Pro 2026",
  description: "Central de operacao e gestao para food service.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('cariocas-pro-theme');
    var theme = stored === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  }
})();`;

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
