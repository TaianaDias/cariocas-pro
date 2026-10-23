import { getFirestore } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminApp, getServerUserProfile } from "../../../../lib/server-auth";
import { FichaError, lerCatalogoFichas, validarAtorFicha } from "../../../../server/catalogo-fichas";

export async function POST(request: NextRequest) {
  try {
    const actor = validarAtorFicha(await getServerUserProfile(request));
    const app = getAdminApp();
    if (!app) throw new FichaError("Serviço indisponível.", 503);
    const data = await lerCatalogoFichas(getFirestore(app), actor);
    return NextResponse.json({ message: "Custos atuais recalculados para consulta. Versões salvas e preços preservados.", receitasRecalculadas: data.receitas.length });
  } catch (error) {
    if (error instanceof FichaError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Falha ao atualizar custos das fichas:", error);
    return NextResponse.json({ error: "Não foi possível atualizar os custos." }, { status: 500 });
  }
}
