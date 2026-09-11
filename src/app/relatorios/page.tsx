"use client";

import { RelatoriosFinanceirosPage } from "../financeiro/relatorios/page";
import { RelatoriosOperacionais } from "../../components/relatorios/RelatoriosOperacionais";
import { useAuth } from "../../hooks/useAuth";
import { isOperationalRole } from "../../lib/access-control";
import { Spinner } from "../../components/ui/Spinner";

export default function RelatoriosPage() {
  const { loading, userProfile } = useAuth();

  if (loading || !userProfile) {
    return <Spinner />;
  }

  if (isOperationalRole(userProfile.role)) {
    return <RelatoriosOperacionais />;
  }

  return <RelatoriosFinanceirosPage />;
}
