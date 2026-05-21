import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/", "/login", "/cadastro"];

function isPublicRoute(pathname: string) {
  return publicRoutes.includes(pathname);
}

function isAuthenticated(request: NextRequest) {
  return Boolean(request.cookies.get("user.uid")?.value);
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
    "/relatorios/:path*",
    "/configuracoes/:path*",
    "/automacoes/:path*",
  ],
};
