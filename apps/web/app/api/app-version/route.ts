import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      deploymentId: process.env.NEXT_PUBLIC_APP_DEPLOYMENT_ID ?? "local",
      deployedAt: process.env.NEXT_PUBLIC_APP_DEPLOYED_AT ?? ""
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}
