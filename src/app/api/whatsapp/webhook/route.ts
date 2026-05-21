import { NextRequest, NextResponse } from "next/server";

import { processarPergunta } from "../../../../services/carioquinha.service";
import { enviarWhatsApp } from "../../../../services/whatsapp.service";
import type { EvolutionWebhookPayload } from "../../../../services/whatsapp.types";

export async function POST(request: NextRequest) {
  try {
    const body: EvolutionWebhookPayload = await request.json();

    if (body?.data?.key?.fromMe) {
      return NextResponse.json({ status: "ignored", reason: "self_message" });
    }

    const mensagem = body?.data?.message;
    const remetente = body?.data?.key?.remoteJid;
    const texto = mensagem?.conversation || mensagem?.extendedTextMessage?.text;
    const nomeRemetente = body?.data?.pushName || "Cliente";

    if (!texto || !remetente) {
      return NextResponse.json({ status: "ignored", reason: "no_text_or_sender" });
    }

    console.log(`[WhatsApp Webhook] Mensagem de ${nomeRemetente} (${remetente}): ${texto}`);

    if (texto.startsWith("!")) {
      return NextResponse.json({ status: "ignored", reason: "internal_command" });
    }

    const { resposta } = await processarPergunta(texto, remetente);
    const enviado = await enviarWhatsApp(remetente, resposta);

    if (!enviado) {
      console.error(`[WhatsApp Webhook] Falha ao enviar resposta para ${remetente}`);
    }

    return NextResponse.json({
      status: "ok",
      recebido: texto,
      respondido: enviado,
    });
  } catch (error) {
    console.error("[WhatsApp Webhook] Erro:", error);

    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    webhook: "whatsapp-carioquinha",
    message: "Webhook da IA Carioquinha ativo. Envie mensagens no WhatsApp.",
  });
}
