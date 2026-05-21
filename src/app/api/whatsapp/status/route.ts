import { NextResponse } from "next/server";

import { getQrCode, getStatusInstancia } from "../../../../services/whatsapp.service";

export async function GET() {
  const instancia = await getStatusInstancia();

  if (!instancia) {
    return NextResponse.json({ status: "offline" });
  }

  if (instancia.status === "qrcode") {
    const qrcode = await getQrCode();

    return NextResponse.json({
      status: "qrcode",
      qrcode,
      owner: null,
      profileName: null,
    });
  }

  return NextResponse.json({
    status: instancia.status,
    owner: instancia.owner || null,
    profileName: instancia.profileName || null,
  });
}
