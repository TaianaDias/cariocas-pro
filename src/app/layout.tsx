import type { ReactNode } from "react";

import "../styles/tokens.css";
import "../styles/global.css";
import "../styles/layout.css";
import "../styles/components.css";
import "../styles/utilities.css";
import "../styles/dashboard.css";
import "../styles/estoque.css";
import "../styles/precificacao.css";
import "../styles/operacional.css";
import "../styles/carioquinha.css";
import "../styles/auth.css";

import { AppShell } from "../components/layout/AppShell";
import { AuthProvider } from "../contexts/AuthContext";

export const metadata = {
  title: "Carioca's Pro 2026",
  description: "Dashboard operacional premium para hamburguerias.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
