import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { mensagem, numero } = await request.json();

    if (!numero || !mensagem) {
      return NextResponse.json({ error: "numero e mensagem sao obrigatorios" }, { status: 400 });
    }

    const apiUrl = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "http://localhost:8080";
    const apiKey = process.env.EVOLUTION_API_KEY || "cariocas-pro-evolution-key-2026";
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "cariocas-pro";

    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: numero.replace(/\D/g, ""),
        options: { delay: 1200, linkPreview: false },
        text: mensagem,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Falha ao enviar" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro WhatsApp send:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
