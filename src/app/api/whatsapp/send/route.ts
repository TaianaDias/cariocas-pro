import { NextRequest, NextResponse } from "next/server";

import { enviarWhatsApp } from "../../../../services/whatsapp.service";

export async function POST(request: NextRequest) {
  try {
    const { mensagem, numero } = await request.json();

    if (!numero || !mensagem) {
      return NextResponse.json({ error: "numero e mensagem sao obrigatorios" }, { status: 400 });
    }

    const enviado = await enviarWhatsApp(numero, mensagem);

    if (!enviado) {
      return NextResponse.json({ error: "Falha ao enviar" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro WhatsApp send:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
