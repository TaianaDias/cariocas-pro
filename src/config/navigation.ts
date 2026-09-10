import { isAdministrativeRole } from "../lib/access-control";

export type NavigationIcon =
  | "dashboard"
  | "estoque"
  | "producao"
  | "reposicao"
  | "compras"
  | "etiquetas"
  | "pedidos"
  | "cozinha"
  | "montagem"
  | "delivery"
  | "salao"
  | "relatorios"
  | "validades"
  | "desperdicio"
  | "checklist"
  | "precificacao"
  | "financeiro"
  | "fornecedores"
  | "funcionarios"
  | "permissoes"
  | "configuracoes"
  | "integracoes"
  | "carioquinha"
  | "planos";

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: NavigationIcon;
  description?: string;
  planned?: boolean;
  showInSidebar?: boolean;
};

export type NavigationSection = {
  id: "operacao" | "rotinas" | "relatorios" | "administracao";
  label: string;
  description: string;
  adminOnly?: boolean;
  items: NavigationItem[];
};

export const navigationSections: NavigationSection[] = [
  {
    id: "operacao",
    label: "Operação",
    description: "Tudo o que a equipe precisa para tocar o dia a dia da loja.",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard", showInSidebar: true },
      { id: "estoque", label: "Estoque", href: "/estoque", icon: "estoque", showInSidebar: true },
      { id: "producao", label: "Produção", href: "/producao", icon: "producao", showInSidebar: true },
      { id: "reposicao", label: "Reposição", href: "/reposicao", icon: "reposicao", showInSidebar: true },
      {
        id: "compras",
        label: "Compras / Movimentações",
        href: "/compras",
        icon: "compras",
        description: "Entradas e saídas manuais ou por código de barras.",
        showInSidebar: true,
      },
      {
        id: "etiquetas",
        label: "Etiquetas",
        href: "/estoque?acao=etiquetas",
        icon: "etiquetas",
        showInSidebar: false,
      },
      {
        id: "pedidos-insumos",
        label: "Pedidos de Insumos",
        href: "/pedidos-insumos",
        icon: "pedidos",
        description: "Solicitações internas de compra feitas pela operação.",
        planned: true,
        showInSidebar: false,
      },
    ],
  },
  {
    id: "rotinas",
    label: "Rotinas e Padrões",
    description: "POPs e checklists separados por setor, com execução simples e rastreável.",
    items: [
      { id: "rotina-cozinha", label: "Cozinha de Produção", href: "/rotinas/cozinha-producao", icon: "cozinha", planned: true },
      { id: "rotina-montagem", label: "Área de Montagem", href: "/rotinas/montagem", icon: "montagem", planned: true },
      { id: "rotina-delivery", label: "Salão / Delivery", href: "/rotinas/salao-delivery", icon: "delivery", planned: true },
      { id: "rotina-reposicao", label: "Salão / Reposição", href: "/rotinas/salao-reposicao", icon: "salao", planned: true },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    description: "Acompanhe a operação e deixe cada relatório pronto para exportar ou imprimir.",
    items: [
      { id: "relatorios-gerais", label: "Movimentações", href: "/relatorios", icon: "relatorios", showInSidebar: true },
      { id: "relatorio-validades", label: "Validades", href: "/relatorios/validades", icon: "validades", planned: true },
      { id: "relatorio-desperdicio", label: "Desperdício", href: "/desperdicio", icon: "desperdicio", showInSidebar: true },
      { id: "relatorio-pedidos", label: "Pedidos de Insumos", href: "/relatorios/pedidos-insumos", icon: "pedidos", planned: true },
      { id: "relatorio-checklists", label: "POPs e Checklists", href: "/relatorios/checklists", icon: "checklist", planned: true },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    description: "Gestão, custos, acessos e configurações sensíveis da empresa.",
    adminOnly: true,
    items: [
      { id: "precificacao", label: "CMV e Precificação", href: "/precificacao", icon: "precificacao", showInSidebar: true },
      { id: "financeiro", label: "Financeiro", href: "/financeiro", icon: "financeiro", showInSidebar: true },
      { id: "fornecedores", label: "Fornecedores e Custos", href: "/fornecedores", icon: "fornecedores", showInSidebar: true },
      { id: "funcionarios", label: "Funcionários", href: "/funcionarios", icon: "funcionarios", showInSidebar: true },
      { id: "permissoes", label: "Usuários e Permissões", href: "/funcionarios", icon: "permissoes", showInSidebar: false },
      { id: "configuracoes", label: "Configurações", href: "/configuracoes", icon: "configuracoes", showInSidebar: true },
      { id: "integracoes", label: "Integrações", href: "/configuracoes/integracoes", icon: "integracoes", planned: true },
      { id: "carioquinha", label: "Carioquinha IA", href: "/configuracoes/carioquinha", icon: "carioquinha", showInSidebar: true },
      { id: "planos", label: "Planos e Assinatura", href: "/planos", icon: "planos", showInSidebar: true },
    ],
  },
];

export function getDashboardSections(role?: string | null) {
  return navigationSections.filter((section) => !section.adminOnly || isAdministrativeRole(role));
}
