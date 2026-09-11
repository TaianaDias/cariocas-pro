import { NextRequest, NextResponse } from "next/server";

import { authorizeAppRequest } from "../../../../lib/server-auth";
import { configurarWebhook, getQrCode, getStatusInstancia, verificarWebhook } from "../../../../services/whatsapp.service";

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

export async function GET(request: NextRequest) {
  const auth = await authorizeAppRequest(request, "/configuracoes");
  if (auth.status !== 200) {
    return jsonNoStore({ status: "error", message: "Acesso não autorizado." }, { status: auth.status });
  }

  const instancia = await getStatusInstancia();
  let webhookAtivo = await verificarWebhook();

  if (!instancia) {
    return jsonNoStore({ status: "offline", webhookAtivo });
  }

  if (instancia.status === "open" && !webhookAtivo) {
    const publicBaseUrl = getPublicBaseUrl(request);
    webhookAtivo = await configurarWebhook(`${publicBaseUrl}/api/whatsapp/webhook`);
  }

  if (instancia.status === "qrcode" || instancia.status === "connecting") {
    const qrcode = await getQrCode();

    if (qrcode) {
      return jsonNoStore({
        status: "qrcode",
        qrcode,
        owner: null,
        profileName: null,
        webhookAtivo,
      });
    }
  }

  return jsonNoStore({
    status: instancia.status,
    owner: instancia.owner || null,
    profileName: instancia.profileName || null,
    webhookAtivo,
  });
}
