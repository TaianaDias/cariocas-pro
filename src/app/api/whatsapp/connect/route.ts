import { NextResponse } from "next/server";

import { criarInstancia, getQrCode } from "../../../../services/whatsapp.service";

export async function POST() {
  const resultado = await criarInstancia();

  if (!resultado.success) {
    return NextResponse.json(
      { status: "error", message: resultado.error || "Erro ao conectar" },
      { status: 500 },
    );
  }

  if (resultado.qrcode) {
    return NextResponse.json({ status: "qrcode", qrcode: resultado.qrcode });
  }

  const qrcode = await getQrCode();

  return NextResponse.json({
    status: qrcode ? "qrcode" : "connecting",
    qrcode,
  });
}
