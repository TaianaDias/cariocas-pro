import { NextRequest, NextResponse } from "next/server";

import { authorizeAppRequest } from "../../../lib/server-auth";
import { processarComandoComprasCarioquinha } from "../../../server/carioquinha-compras";
import { processarPergunta } from "../../../services/carioquinha.service";

export async function POST(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/dashboard");
  if (access.status !== 200) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: access.status });
  }

  const body = (await request.json().catch(() => ({}))) as { pergunta?: unknown };
  const pergunta = typeof body.pergunta === "string" ? body.pergunta.trim().slice(0, 4000) : "";
  if (!pergunta) {
    return NextResponse.json({ error: "Digite uma mensagem para a Carioquinha." }, { status: 400 });
  }

  try {
    const contexto = {
      empresaId: access.empresaId,
      lojaId: access.lojaId,
      uid: access.profile.uid,
    };
    const compras = await processarComandoComprasCarioquinha(pergunta, contexto);
    if (compras.handled) {
      return NextResponse.json({ resposta: compras.resposta || "Comando processado.", dados: compras.dados });
    }

    const resultado = await processarPergunta(pergunta, access.profile.uid, contexto);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[Carioquinha API] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível processar a mensagem agora." },
      { status: 500 },
    );
  }
}
