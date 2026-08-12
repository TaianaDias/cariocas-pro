import { NextResponse } from "next/server";

import { getQrCode, getStatusInstancia, verificarWebhook } from "../../../../services/whatsapp.service";

export async function GET() {
  const instancia = await getStatusInstancia();
  const webhookAtivo = await verificarWebhook();

  if (!instancia) {
    return NextResponse.json({ status: "offline", webhookAtivo });
  }

  if (instancia.status === "qrcode" || instancia.status === "connecting") {
    const qrcode = await getQrCode();

    if (qrcode) {
      return NextResponse.json({
        status: "qrcode",
        qrcode,
        owner: null,
        profileName: null,
        webhookAtivo,
      });
    }
  }

  return NextResponse.json({
    status: instancia.status,
    owner: instancia.owner || null,
    profileName: instancia.profileName || null,
    webhookAtivo,
  });
}
