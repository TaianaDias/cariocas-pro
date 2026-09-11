import { NextRequest, NextResponse } from "next/server";

import { authorizeAppRequest } from "../../../../lib/server-auth";
import { logoutInstancia } from "../../../../services/whatsapp.service";

export async function POST(request: NextRequest) {
  const auth = await authorizeAppRequest(request, "/configuracoes");
  if (auth.status !== 200) {
    return NextResponse.json({ status: "error", message: "Acesso não autorizado." }, { status: auth.status });
  }

  const ok = await logoutInstancia();

  return NextResponse.json({ status: ok ? "disconnected" : "error" });
}
