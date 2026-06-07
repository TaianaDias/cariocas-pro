import { NextResponse, type NextRequest } from "next/server";

import { authorizePrecificacaoRequest } from "../../../../lib/server-auth";
import { listarInsumos } from "../../../../services/estoque.service";
import {
  atualizarIngredientesComEstoque,
  custosFixosPadrao,
  custosVariaveisPadrao,
  listarReceitasPrecificacao,
  metasPadrao,
  recalcularReceita,
  salvarReceitaPrecificacao,
} from "../../../../services/precificacao.service";

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

  const insumos = await listarInsumos();
  const receitas = await listarReceitasPrecificacao(authorization.empresaId, authorization.lojaId || undefined);
  const recalculadas = receitas.map((receita) =>
    recalcularReceita(
      {
        ...receita,
        ingredientes: atualizarIngredientesComEstoque(receita.ingredientes || [], insumos),
      },
      { ...custosFixosPadrao, empresaId: authorization.empresaId, lojaId: authorization.lojaId || "matriz" },
      custosVariaveisPadrao,
      { ...metasPadrao, empresaId: authorization.empresaId, lojaId: authorization.lojaId || "matriz" },
    ),
  );

  await Promise.all(recalculadas.map((receita) => salvarReceitaPrecificacao(receita)));

  return NextResponse.json({
    empresaId: authorization.empresaId,
    lojaId: authorization.lojaId || null,
    message: "Receitas recalculadas com custos atuais do estoque.",
    receitasRecalculadas: recalculadas.length,
  });
}
