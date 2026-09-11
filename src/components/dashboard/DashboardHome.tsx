"use client";

import { getDashboardSections } from "../../config/navigation";
import { useAuth } from "../../hooks/useAuth";
import { useDashboardData } from "../../hooks/useDashboardData";
import { isAdministrativeRole } from "../../lib/access-control";
import { ModuleSection } from "./ModuleSection";
import { OperationalSummary } from "./OperationalSummary";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardHome() {
  const { user, userProfile } = useAuth();
  const { comprasRecomendadas, error, kpis, loading, produtosVencer } = useDashboardData();
  const role = userProfile?.role || "user";
  const permissions = userProfile?.permissoes || [];
  const plan = userProfile?.plano || userProfile?.plan || "free";
  const sections = getDashboardSections(role, permissions, plan);
  const displayName = userProfile?.nome || user?.displayName || "equipe";
  const firstName = displayName.trim().split(/\s+/)[0] || "equipe";
  const administrative = isAdministrativeRole(role);

  return (
    <div className="dashboard-home">
      <section className="dashboard-hero">
        <div className="dashboard-hero__copy">
          <span className="dashboard-hero__eyebrow">Painel central da operação</span>
          <h1>{getGreeting()}, {firstName}.</h1>
          <p>
            {administrative
              ? "Acompanhe a operação e acesse a gestão administrativa a partir de uma única central."
              : "Veja o que precisa de atenção no turno e acesse somente as ferramentas da sua operação."}
          </p>
        </div>
        <div className="dashboard-hero__badge" aria-label="Perfil atual">
          <span>{administrative ? "Gestão" : "Operação"}</span>
          <strong>{administrative ? "Acesso administrativo" : "Acesso operacional"}</strong>
        </div>
      </section>

      <OperationalSummary
        criticalItems={kpis?.itensCriticos || 0}
        pendingReplenishment={kpis?.reposicaoPendente || 0}
        expiringItems={produtosVencer.length}
        suggestedPurchases={comprasRecomendadas.length}
        loading={loading}
      />

      {error ? (
        <div className="dashboard-notice" role="status">
          Alguns indicadores não puderam ser carregados agora. Os módulos continuam disponíveis normalmente.
        </div>
      ) : null}

      <div className="dashboard-sections">
        {sections.map((section) => (
          <ModuleSection section={section} key={section.id} />
        ))}
      </div>
    </div>
  );
}
