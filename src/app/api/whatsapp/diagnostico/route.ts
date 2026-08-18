import { NextResponse } from "next/server";

import { diagnosticarWhatsApp } from "../../../../services/whatsapp.service";

export async function GET() {
  const diagnostico = await diagnosticarWhatsApp();
  const status = diagnostico.evolutionOnline ? 200 : 502;
  const response = NextResponse.json(diagnostico, { status });

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  return response;
}
