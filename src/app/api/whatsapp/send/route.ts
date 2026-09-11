import { NextRequest, NextResponse } from "next/server";

import { authorizeAppRequest } from "../../../../lib/server-auth";
import { enviarWhatsApp } from "../../../../services/whatsapp.service";

export async function POST(request: NextRequest) {
  const auth = await authorizeAppRequest(request, "/configuracoes");
  if (auth.status !== 200) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: auth.status });
  }

  try {
    const { mensagem, numero } = await request.json();

    if (!numero || !mensagem) {
      return NextResponse.json({ error: "Número e mensagem são obrigatórios." }, { status: 400 });
    }

    const enviado = await enviarWhatsApp(numero, mensagem);

    if (!enviado) {
      return NextResponse.json({ error: "Falha ao enviar a mensagem." }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro WhatsApp send:", error);
    return NextResponse.json({ error: "Erro interno ao enviar a mensagem." }, { status: 500 });
  }
}
