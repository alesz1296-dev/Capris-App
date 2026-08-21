import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:4000/api/v1";
  const isReady = Boolean(apiBaseUrl);

  return NextResponse.json(
    {
      status: isReady ? "ok" : "degraded",
      checks: {
        web: "ok",
        apiBaseUrl: isReady ? "configured" : "missing"
      }
    },
    {
      status: isReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}
