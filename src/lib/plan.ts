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
    "precificacao.ficha_simples",
  ],
  plus: [
    ...essencialFeatures,
    "cmv.avancado",
    "curva.abc",
    "desperdicio.avancado",
    "reposicao.ia",
    "previsao.demanda",
    "relatorios.avancados",
    "ia.carioca",
    "etiquetas.qrcode",
    "precificacao.inteligente",
    "precificacao.ver",
    "precificacao.configurar",
    "precificacao.verCustos",
    "precificacao.recalcular",
    "precificacao.aplicarPreco",
    "precificacao.relatorio",
  ],
  full: [
    ...essencialFeatures,
    "cmv.avancado",
    "curva.abc",
    "desperdicio.avancado",
    "reposicao.ia",
    "previsao.demanda",
    "relatorios.avancados",
    "ia.carioca",
    "etiquetas.qrcode",
    "precificacao.inteligente",
    "precificacao.ver",
    "precificacao.configurar",
    "precificacao.verCustos",
    "precificacao.recalcular",
    "precificacao.aplicarPreco",
    "precificacao.relatorio",
  ],
} as const;

export type Plano = keyof typeof planFeatures;
export type Plan = Plano;
export type Feature = (typeof planFeatures)[Plano][number];

export const planOrder: Record<Plano, number> = {
  free: 0,
  essencial: 1,
  pro: 2,
  plus: 3,
  full: 4,
};

export const planCatalog: Record<
  Plano,
  {
    badge: string;
    cta: string;
    description: string;
    featured?: boolean;
    name: string;
    price: string;
    shortFeatures: string[];
  }
> = {
  free: {
    badge: "Inicio",
    cta: "Usar Free",
    description: "Para testar o sistema e controlar o basico da operacao.",
    name: "Free",
    price: "R$ 0",
    shortFeatures: ["Estoque basico", "Alertas simples", "Cadastro inicial", "Relatorio simples"],
  },
  essencial: {
    badge: "Operacao",
    cta: "Ativar Essencial",
    description: "Para organizar compras, producao e fornecedores com rotina profissional.",
    name: "Essencial",
    price: "R$ 49",
    shortFeatures: ["Tudo do Free", "Compras", "Producao basica", "Fornecedores"],
  },
  pro: {
    badge: "Crescimento",
    cta: "Ativar Pro",
    description: "Para acompanhar CMV, desperdicio, reposicao inteligente e relatorios avancados.",
    name: "Pro",
    price: "R$ 99",
    shortFeatures: ["Tudo do Essencial", "CMV avancado", "Desperdicio", "IA Carioquinha"],
  },
  plus: {
    badge: "Mais vendido",
    cta: "Ativar Plus",
    description: "Para liberar precificacao inteligente, simulacoes e decisao financeira.",
    featured: true,
    name: "Plus",
    price: "R$ 149",
    shortFeatures: ["Tudo do Pro", "Precificacao Inteligente", "Custos e margem", "Relatorios premium"],
  },
  full: {
    badge: "Completo",
    cta: "Ativar Full",
    description: "Para operacoes que querem automacoes, canais e gestao completa.",
    name: "Full",
    price: "R$ 249",
    shortFeatures: ["Tudo do Plus", "WhatsApp", "Equipe", "Automacoes completas"],
  },
};

export function hasFeature(plan: Plano, feature: Feature) {
  return (planFeatures[plan] as readonly string[]).includes(feature);
}

export function normalizePlano(plan?: string | null): Plano {
  if (plan === "essencial" || plan === "pro" || plan === "plus" || plan === "full") {
    return plan;
  }

  return "free";
}

export function planMeets(currentPlan?: string | null, requiredPlan: Plano = "free") {
  return planOrder[normalizePlano(currentPlan)] >= planOrder[requiredPlan];
}

export const routePlanRequirements: { path: string; plan: Plano }[] = [
  { path: "/dashboard", plan: "free" },
  { path: "/estoque", plan: "free" },
  { path: "/compras", plan: "essencial" },
  { path: "/producao", plan: "essencial" },
  { path: "/fornecedores", plan: "essencial" },
  { path: "/reposicao", plan: "essencial" },
  { path: "/desperdicio", plan: "pro" },
  { path: "/financeiro", plan: "pro" },
  { path: "/relatorios", plan: "pro" },
  { path: "/configuracoes/carioquinha", plan: "pro" },
  { path: "/precificacao", plan: "pro" },
  { path: "/funcionarios", plan: "full" },
  { path: "/configuracoes/whatsapp", plan: "full" },
];

export function getRequiredPlanForPath(pathname: string): Plano {
  const match = routePlanRequirements
    .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];

  return match?.plan || "free";
}

export function canOpenPath(currentPlan: string | null | undefined, pathname: string) {
  return planMeets(currentPlan, getRequiredPlanForPath(pathname));
}

export function getDynamicPlanRules() {
  return null;
}
