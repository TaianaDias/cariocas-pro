import { NextResponse } from "next/server";

import { configurarWebhook, criarInstancia, getQrCode } from "../../../../services/whatsapp.service";

export async function POST(request: Request) {
  const resultado = await criarInstancia();

  if (!resultado.success) {
    return NextResponse.json(
      { status: "error", message: resultado.error || "Erro ao conectar" },
      { status: 500 },
    );
  }

  const origin = request.headers.get("origin") || new URL(request.url).origin;
  await configurarWebhook(`${origin}/api/whatsapp/webhook`);

  if (resultado.qrcode) {
    return NextResponse.json({ status: "qrcode", qrcode: resultado.qrcode });
  }

  const qrcode = await getQrCode();

  return NextResponse.json({
    status: qrcode ? "qrcode" : "connecting",
    qrcode,
  });
}
