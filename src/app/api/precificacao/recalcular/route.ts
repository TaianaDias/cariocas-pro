import { NextResponse, type NextRequest } from "next/server";

import { authorizePrecificacaoRequest } from "../../../../lib/server-auth";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { empresaId?: string; lojaId?: string };
  const authorization = await authorizePrecificacaoRequest(
    request,
    "precificacao.recalcular",
    body.empresaId,
    body.lojaId,
  );

  if (authorization.status === 401) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  if (authorization.status === 400) {
    return NextResponse.json({ error: "empresaId e obrigatorio." }, { status: 400 });
  }

  if (authorization.status === 403) {
    return NextResponse.json({ error: "Plano, permissao ou empresa invalidos para recalcular precificacao." }, { status: 403 });
  }

  return NextResponse.json({
    empresaId: authorization.empresaId,
    lojaId: authorization.lojaId || null,
    message: "Recalculo autorizado. A fila deve processar apenas receitas impactadas por empresaId e lojaId.",
  });
}
