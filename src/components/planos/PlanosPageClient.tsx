"use client";

import { useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { planCatalog, planFeatures, type Plano } from "../../lib/plan";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const planos: Plano[] = ["free", "essencial", "pro", "plus", "full"];

const recursosPreview = [
  "Controle de estoque",
  "Compras e fornecedores",
  "Producao e fichas",
  "Desperdicio e CMV",
  "Precificacao Inteligente",
  "WhatsApp e equipe",
];

const recursoPorPlano: Record<string, Plano> = {
  "Controle de estoque": "free",
  "Compras e fornecedores": "essencial",
  "Producao e fichas": "essencial",
  "Desperdicio e CMV": "pro",
  "Precificacao Inteligente": "plus",
  "WhatsApp e equipe": "full",
};

const planRank: Record<Plano, number> = {
  free: 0,
  essencial: 1,
  pro: 2,
  plus: 3,
  full: 4,
};

function hasResource(plan: Plano, resource: string) {
  return planRank[plan] >= planRank[recursoPorPlano[resource]];
}

export function PlanosPageClient() {
  const { updatePlan, user, userProfile } = useAuth();
  const planoAtual = (userProfile?.plano || userProfile?.plan || "free") as Plano;
  const [savingPlan, setSavingPlan] = useState<Plano | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function escolherPlano(plano: Plano) {
    if (!user) {
      window.location.href = `/cadastro?plano=${plano}`;
      return;
    }

    setSavingPlan(plano);
    setFeedback(null);

    try {
      await updatePlan(plano);
      setFeedback(`Plano ${planCatalog[plano].name} ativado. Permissoes atualizadas no sistema.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel atualizar o plano.");
    } finally {
      setSavingPlan(null);
    }
  }

  return (
    <main className="plans-page">
      <section className="plans-hero">
        <div className="plans-hero__media" aria-hidden="true">
          <div>
            <span>CMV</span>
            <strong>27.4%</strong>
          </div>
          <div>
            <span>Margem</span>
            <strong>42%</strong>
          </div>
          <div>
            <span>Preco ideal</span>
            <strong>R$ 31,90</strong>
          </div>
        </div>
        <div className="plans-hero__content">
          <a className="plans-logo" href="/">Carioca&apos;s Pro</a>
          <Badge tone="danger">Planos SaaS para food service</Badge>
          <h1>Escolha o plano certo para liberar a operacao que voce precisa hoje</h1>
          <p>Comece simples, evolua para gestao profissional e desbloqueie precificacao, CMV, relatorios e automacoes quando fizer sentido.</p>
          <div className="plans-hero__actions">
            <a className="button button--primary" href="#comparar">Comparar planos</a>
            <a className="button button--secondary" href={user ? "/dashboard" : "/cadastro"}>{user ? "Voltar ao sistema" : "Criar conta"}</a>
          </div>
        </div>
      </section>

      <section className="plans-section" id="comparar">
        <div className="plans-section__header">
          <span>Comparativo</span>
          <h2>Uma liberacao clara para cada momento da hamburgueria</h2>
        </div>

        <div className="plans-grid">
          {planos.map((plano) => {
            const detalhes = planCatalog[plano];
            const ativo = user && planoAtual === plano;

            return (
              <Card className={`plans-card ${detalhes.featured ? "plans-card--featured" : ""}`.trim()} key={plano}>
                <div className="plans-card__top">
                  <Badge tone={detalhes.featured ? "danger" : "neutral"}>{detalhes.badge}</Badge>
                  {ativo ? <span>Ativo</span> : null}
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
                <Button fullWidth variant={ativo ? "secondary" : "primary"} disabled={Boolean(ativo) || savingPlan !== null} onClick={() => escolherPlano(plano)}>
                  {savingPlan === plano ? "Ativando..." : ativo ? "Plano atual" : user ? detalhes.cta : "Comecar agora"}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="plans-compare">
        <div className="plans-section__header">
          <span>Permissoes</span>
          <h2>O que cada clique libera no sistema</h2>
        </div>
        <div className="plans-table">
          <div className="plans-table__row plans-table__row--head">
            <strong>Recurso</strong>
            {planos.map((plano) => <strong key={plano}>{planCatalog[plano].name}</strong>)}
          </div>
          {recursosPreview.map((resource) => (
            <div className="plans-table__row" key={resource}>
              <span>{resource}</span>
              {planos.map((plano) => (
                <span className={hasResource(plano, resource) ? "is-enabled" : "is-disabled"} key={`${resource}-${plano}`}>
                  {hasResource(plano, resource) ? "Liberado" : "Bloqueado"}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="plans-section plans-section--modules">
        <div className="plans-section__header">
          <span>Preview tecnico</span>
          <h2>Recursos internos por plano</h2>
        </div>
        <div className="plans-modules">
          {planos.map((plano) => (
            <Card className="plans-module-card" key={plano}>
              <strong>{planCatalog[plano].name}</strong>
              <p>{planFeatures[plano].slice(0, 8).join(" • ")}</p>
            </Card>
          ))}
        </div>
      </section>

      {feedback ? <p className="plans-feedback">{feedback}</p> : null}
    </main>
  );
}
