import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/", "/login", "/cadastro", "/planos", "/auditoria"];

const planOrder: Record<string, number> = {
  free: 0,
  essencial: 1,
  pro: 2,
  plus: 3,
  full: 4,
};

const routeRequirements = [
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

function isPublicRoute(pathname: string) {
  return publicRoutes.includes(pathname);
}

function isAuthenticated(request: NextRequest) {
  return Boolean(request.cookies.get("user.uid")?.value);
}

function normalizePlan(plan?: string) {
  return plan === "essencial" || plan === "pro" || plan === "plus" || plan === "full" ? plan : "free";
}

function getRequiredPlan(pathname: string) {
  const match = routeRequirements
    .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];

  return match?.plan || "free";
}

function canOpenRoute(request: NextRequest, pathname: string) {
  const plan = normalizePlan(request.cookies.get("user.plan")?.value);
  const requiredPlan = getRequiredPlan(pathname);

  return planOrder[plan] >= planOrder[requiredPlan];
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = isAuthenticated(request);

  if (authenticated && (pathname === "/login" || pathname === "/cadastro")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!authenticated && !isPublicRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authenticated && !canOpenRoute(request, pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/cadastro",
    "/auditoria/:path*",
    "/dashboard/:path*",
    "/estoque/:path*",
    "/compras/:path*",
    "/producao/:path*",
    "/desperdicio/:path*",
    "/fornecedores/:path*",
    "/funcionarios/:path*",
    "/financeiro/:path*",
    "/precificacao/:path*",
    "/relatorios/:path*",
    "/reposicao/:path*",
    "/configuracoes/:path*",
    "/automacoes/:path*",
  ],
};
