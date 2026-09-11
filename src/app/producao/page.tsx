"use client";

import { ProducaoPageClient } from "../../components/operacional/OperationalPages";
import { ProducaoOperacional } from "../../components/producao/ProducaoOperacional";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../hooks/useAuth";
import { isOperationalRole } from "../../lib/access-control";

export default function ProducaoPage() {
  const { loading, userProfile } = useAuth();

  if (loading || !userProfile) {
    return <Spinner />;
  }

  if (isOperationalRole(userProfile.role)) {
    return <ProducaoOperacional />;
  }

  return <ProducaoPageClient />;
}
