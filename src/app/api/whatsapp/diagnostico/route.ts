import { NextRequest, NextResponse } from "next/server";

import { authorizeAppRequest } from "../../../../lib/server-auth";
import { diagnosticarWhatsApp } from "../../../../services/whatsapp.service";

export async function GET(request: NextRequest) {
  const auth = await authorizeAppRequest(request, "/configuracoes");
  if (auth.status !== 200) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: auth.status });
  }

  const diagnostico = await diagnosticarWhatsApp();
  const status = diagnostico.evolutionOnline ? 200 : 502;
  const response = NextResponse.json(diagnostico, { status });

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  return response;
}
