import { NextResponse } from "next/server";

import { logoutInstancia } from "../../../../services/whatsapp.service";

export async function POST() {
  const ok = await logoutInstancia();

  return NextResponse.json({ status: ok ? "disconnected" : "error" });
}
