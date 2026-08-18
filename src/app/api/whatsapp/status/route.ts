import { NextResponse } from "next/server";

import { getQrCode, getStatusInstancia, verificarWebhook } from "../../../../services/whatsapp.service";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  return response;
}

export async function GET() {
  const instancia = await getStatusInstancia();
  const webhookAtivo = await verificarWebhook();

  if (!instancia) {
    return jsonNoStore({ status: "offline", webhookAtivo });
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
