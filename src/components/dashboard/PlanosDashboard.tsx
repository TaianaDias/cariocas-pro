"use client";

import { planCatalog, type Plano } from "../../lib/plan";
import { useAuth } from "../../hooks/useAuth";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export function PlanosDashboard() {
  const { userProfile } = useAuth();
  const planoAtual = (userProfile?.plano || userProfile?.plan || "free") as Plano;

  return (
    <section className="dashboard-planos" aria-label="Planos do sistema">
      <header className="dashboard-planos__header">
        <div>
          <span>Planos e permissoes</span>
          <h2>Libere mais recursos conforme sua operacao cresce</h2>
          <p>Veja uma previa dos modos pagos, compare os recursos e escolha exatamente o que fica liberado para cada plano.</p>
        </div>
        <div className="dashboard-planos__actions">
          <Badge tone="success">Atual: {planCatalog[planoAtual]?.name || "Free"}</Badge>
          <a className="button button--primary" href="/planos">Ver planos</a>
        </div>
      </header>
    </section>
  );
}
