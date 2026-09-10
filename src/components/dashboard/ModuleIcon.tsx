import type { ReactNode, SVGProps } from "react";

import type { NavigationIcon } from "../../config/navigation";

const iconPaths: Record<NavigationIcon, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  estoque: <><path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" /><path d="M4 7.5V16l8 5 8-5V7.5" /><path d="M12 12v9" /></>,
  producao: <><path d="M5 9a7 7 0 0 1 14 0" /><path d="M4 9h16" /><path d="M7 9v8h10V9" /><path d="M9 4v2M15 4v2" /></>,
  reposicao: <><path d="M20 7h-5V2" /><path d="M4 17h5v5" /><path d="M5.5 9A7 7 0 0 1 18 5l2 2" /><path d="M18.5 15A7 7 0 0 1 6 19l-2-2" /></>,
  compras: <><path d="M3 5h2l2.3 10.2h9.9l2-7.2H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  etiquetas: <><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" /><circle cx="8" cy="8" r="1.4" /></>,
  pedidos: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 2h6v4H9zM8 11h8M8 15h6" /></>,
  cozinha: <><path d="M8 3v7M5 3v4a3 3 0 0 0 6 0V3M8 10v11" /><path d="M16 3v18M16 3c3 2 3 6 0 8" /></>,
  montagem: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  delivery: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  salao: <><path d="M4 10h16M6 10v8M18 10v8M8 6h8v4" /><path d="M3 18h4M17 18h4" /></>,
  relatorios: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
  validades: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 9h18" /><path d="m9 15 2 2 4-4" /></>,
  desperdicio: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /><path d="M10 11v6M14 11v6" /></>,
  checklist: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 9 2 2 4-4M8 15h8" /></>,
  precificacao: <><circle cx="12" cy="12" r="9" /><path d="M12 6v12M15 8.5c-.8-.6-1.7-.9-2.8-.9-1.6 0-2.7.8-2.7 2s1.1 1.8 2.8 2.2 3.2.9 3.2 2.6-1.4 2.7-3.4 2.7c-1.2 0-2.4-.4-3.3-1.1" /></>,
  financeiro: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  fornecedores: <><path d="M4 21V7l8-4 8 4v14" /><path d="M8 21v-5h8v5M8 9h1M12 9h1M16 9h1M8 13h1M12 13h1M16 13h1" /></>,
  funcionarios: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.6-4 2.7-6 6-6s5.4 2 6 6" /><circle cx="17" cy="9" r="2" /><path d="M16 14c2.7.2 4.3 1.8 5 5" /></>,
  permissoes: <><path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3Z" /><path d="M9 12h6M12 9v6" /></>,
  configuracoes: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.6v.2h-4V21a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3 14H2.8v-4H3a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.4-2l-.1-.1 2.8-2.8.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 10 3V2.8h4V3a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1 2.8 2.8-.1.1a1.8 1.8 0 0 0-.4 2A1.8 1.8 0 0 0 21 10h.2v4H21a1.8 1.8 0 0 0-1.6 1Z" /></>,
  integracoes: <><path d="M8 7V3M16 7V3M6 7h12v4a6 6 0 0 1-12 0V7Z" /><path d="M12 17v4M9 21h6" /></>,
  carioquinha: <><rect x="4" y="6" width="16" height="13" rx="4" /><path d="M9 11h.01M15 11h.01M9 15h6M12 3v3" /></>,
  planos: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></>,
};

type ModuleIconProps = SVGProps<SVGSVGElement> & {
  name: NavigationIcon;
};

export function ModuleIcon({ name, ...props }: ModuleIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {iconPaths[name]}
    </svg>
  );
}
