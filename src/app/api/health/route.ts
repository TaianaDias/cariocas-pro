import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    memory: process.memoryUsage().rss,
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

