"use client";

import { useState } from "react";

import { planCatalog, planMeets, type Plano } from "../../lib/plan";
import { useAuth } from "../../hooks/useAuth";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const planos: Plano[] = ["free", "essencial", "pro", "plus", "full"];

export function PlanosDashboard() {
  const { updatePlan, userProfile } = useAuth();
  const planoAtual = (userProfile?.plano || userProfile?.plan || "free") as Plano;
  const [savingPlan, setSavingPlan] = useState<Plano | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function escolherPlano(plano: Plano) {
    setSavingPlan(plano);
    setFeedback(null);

    try {
      await updatePlan(plano);
      setFeedback(`Plano ${planCatalog[plano].name} ativado. As permissoes ja foram atualizadas.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel atualizar o plano.");
    } finally {
      setSavingPlan(null);
    }
  }

  return (
    <section className="dashboard-planos" aria-label="Planos do sistema">
      <header className="dashboard-planos__header">
        <div>
          <span>Planos e permissoes</span>
          <h2>Escolha o modo que combina com sua operacao</h2>
          <p>Cada plano libera apenas os modulos e recursos correspondentes. Voce pode trocar aqui para testar a experiencia de cada etapa.</p>
        </div>
        <Badge tone={planMeets(planoAtual, "plus") ? "success" : "warning"}>Atual: {planCatalog[planoAtual]?.name || "Free"}</Badge>
      </header>

      <div className="dashboard-planos__grid">
        {planos.map((plano) => {
          const detalhes = planCatalog[plano];
          const ativo = planoAtual === plano;

          return (
            <Card className={`dashboard-plano-card ${detalhes.featured ? "dashboard-plano-card--featured" : ""}`.trim()} key={plano}>
              <div className="dashboard-plano-card__top">
                <Badge tone={detalhes.featured ? "danger" : "neutral"}>{detalhes.badge}</Badge>
                {ativo ? <span className="dashboard-plano-card__active">Ativo</span> : null}
              </div>
              <div>
                <h3>{detalhes.name}</h3>
                <strong>{detalhes.price}<small>/mes</small></strong>
                <p>{detalhes.description}</p>
              </div>
              <ul>
                {detalhes.shortFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Button fullWidth variant={ativo ? "secondary" : "primary"} onClick={() => escolherPlano(plano)} disabled={ativo || savingPlan !== null}>
                {savingPlan === plano ? "Ativando..." : ativo ? "Plano atual" : detalhes.cta}
              </Button>
            </Card>
          );
        })}
      </div>

      {feedback ? <p className="dashboard-planos__feedback">{feedback}</p> : null}
    </section>
  );
}
