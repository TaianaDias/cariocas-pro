import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/", "/login", "/cadastro"];

function isPublicRoute(pathname: string) {
  return publicRoutes.includes(pathname);
}

function isAuthenticated(request: NextRequest) {
  return Boolean(request.cookies.get("user.uid")?.value);
}

function canOpenPrecificacao(request: NextRequest) {
  const plan = request.cookies.get("user.plan")?.value;

  return plan === "pro" || plan === "plus" || plan === "full";
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

  if (pathname.startsWith("/precificacao") && !canOpenPrecificacao(request)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/cadastro",
    "/dashboard/:path*",
    "/estoque/:path*",
    "/compras/:path*",
    "/producao/:path*",
    "/desperdicio/:path*",
    "/fornecedores/:path*",
    "/funcionarios/:path*",
    "/precificacao/:path*",
    "/relatorios/:path*",
    "/configuracoes/:path*",
    "/automacoes/:path*",
  ],
};
