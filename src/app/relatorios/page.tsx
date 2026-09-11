"use client";

import { RelatoriosFinanceiros } from "../../components/financeiro/RelatoriosFinanceiros";
import { RelatoriosOperacionais } from "../../components/relatorios/RelatoriosOperacionais";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../hooks/useAuth";
import { isOperationalRole } from "../../lib/access-control";

export default function RelatoriosPage() {
  const { loading, userProfile } = useAuth();

  if (loading || !userProfile) {
    return <Spinner />;
  }

  if (isOperationalRole(userProfile.role)) {
    return <RelatoriosOperacionais />;
  }

  return <RelatoriosFinanceiros />;
}
