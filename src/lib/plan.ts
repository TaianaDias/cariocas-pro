const freeFeatures = [
  "estoque.basico",
  "alertas.basicos",
  "cadastro.simples",
  "login",
  "relatorio.simples",
] as const;

const essencialFeatures = [
  ...freeFeatures,
  "ficha.tecnica",
  "compras",
  "reposicao.basica",
  "producao.basica",
  "fornecedores.basico",
] as const;

export const planFeatures = {
  free: freeFeatures,
  essencial: essencialFeatures,
  pro: [
    ...essencialFeatures,
    "cmv.avancado",
    "curva.abc",
    "desperdicio.avancado",
    "reposicao.ia",
    "previsao.demanda",
    "relatorios.avancados",
    "ia.carioca",
    "etiquetas.qrcode",
  ],
} as const;

export type Plano = keyof typeof planFeatures;
export type Plan = Plano;
export type Feature = (typeof planFeatures)[Plano][number];

export function hasFeature(plan: Plano, feature: Feature) {
  return (planFeatures[plan] as readonly string[]).includes(feature);
}

export function getDynamicPlanRules() {
  return null;
}
