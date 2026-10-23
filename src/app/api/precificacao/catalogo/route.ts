import { getFirestore } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminApp, getServerUserProfile } from "../../../../lib/server-auth";
import { criarInsumoFichaSchema, atualizarCustoFichaSchema, salvarFichaSchema } from "../../../../schemas/precificacao.schema";
import { atualizarCustoParaFicha, criarInsumoParaFicha, FichaError, lerCatalogoFichas, salvarFichaConfiavel, validarAtorFicha } from "../../../../server/catalogo-fichas";

function failure(error: unknown) {
  if (error instanceof FichaError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Falha no catálogo de fichas:", error);
  return NextResponse.json({ error: "Não foi possível concluir. Seus dados do formulário foram preservados; tente novamente." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    // Custos nesta entrega seguem a política existente de administradores Plus/Full.
    const actor = validarAtorFicha(await getServerUserProfile(request));
    const app = getAdminApp();
    if (!app) throw new FichaError("Serviço indisponível. Verifique a configuração do servidor.", 503);
    return NextResponse.json(await lerCatalogoFichas(getFirestore(app), actor), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = validarAtorFicha(await getServerUserProfile(request));
    const body = await request.json().catch(() => null);
    const schemas = { criarInsumo: criarInsumoFichaSchema, atualizarCusto: atualizarCustoFichaSchema, salvarFicha: salvarFichaSchema };
    if (!body || !Object.prototype.hasOwnProperty.call(schemas, body.acao)) throw new FichaError("Operação inválida.");
    const app = getAdminApp();
    if (!app) throw new FichaError("Serviço indisponível.", 503);
    const db = getFirestore(app);
    if (body.acao === "criarInsumo") {
      const parsed = criarInsumoFichaSchema.safeParse(body);
      if (!parsed.success) throw new FichaError(parsed.error.issues[0].message);
      return NextResponse.json(await criarInsumoParaFicha(db, actor, parsed.data));
    }
    if (body.acao === "atualizarCusto") {
      const parsed = atualizarCustoFichaSchema.safeParse(body);
      if (!parsed.success) throw new FichaError(parsed.error.issues[0].message);
      return NextResponse.json(await atualizarCustoParaFicha(db, actor, parsed.data));
    }
    const parsed = salvarFichaSchema.safeParse(body);
    if (!parsed.success) throw new FichaError(parsed.error.issues[0].message);
    return NextResponse.json(await salvarFichaConfiavel(db, actor, parsed.data));
  } catch (error) { return failure(error); }
}
