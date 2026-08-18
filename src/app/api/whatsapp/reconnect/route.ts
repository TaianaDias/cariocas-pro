import { NextResponse } from "next/server";

import { configurarWebhook, recriarInstancia } from "../../../../services/whatsapp.service";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  return response;
}

function getPublicBaseUrl(request: Request) {
  const configured =
    process.env.WHATSAPP_WEBHOOK_BASE_URL ||
    process.env.APP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") || "http";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");

  if (host) {
    return `${forwardedProto}://${host}`.replace(/\/$/, "");
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const resultado = await recriarInstancia();

    if (!resultado.success) {
      return jsonNoStore(
        { status: "error", message: resultado.error || "Erro ao recriar sessao do WhatsApp" },
        { status: 500 },
      );
    }

    const publicBaseUrl = getPublicBaseUrl(request);
    const webhookAtivo = await configurarWebhook(`${publicBaseUrl}/api/whatsapp/webhook`);

    return jsonNoStore({
      status: resultado.qrcode ? "qrcode" : "connecting",
      qrcode: resultado.qrcode || null,
      webhookAtivo,
    });
  } catch (error) {
    console.error("[WhatsApp Reconnect] Erro:", error);
    return jsonNoStore(
      { status: "error", message: error instanceof Error ? error.message : "Erro interno ao recriar sessao" },
      { status: 500 },
    );
  }
}
