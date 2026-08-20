import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      checks: {
        web: "ok",
        process: "ok"
      },
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? "development"
      }
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}
