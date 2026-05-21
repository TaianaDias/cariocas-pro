import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  return NextResponse.json({
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY ? "***" : "(nao configurado)",
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "***" : "(nao configurado)",
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "***" : "(nao configurado)",
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "***" : "(nao configurado)",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_EVOLUTION_API_URL: process.env.NEXT_PUBLIC_EVOLUTION_API_URL,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NODE_ENV: process.env.NODE_ENV,
    WHATSAPP_ADMIN_NUMBER: process.env.WHATSAPP_ADMIN_NUMBER ? "***" : "(nao configurado)",
  });
}

