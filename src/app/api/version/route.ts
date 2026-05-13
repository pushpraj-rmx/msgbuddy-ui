import { NextResponse } from "next/server";

// Build-time identifier — changes every deploy, even if package version is same.
// process.env.NEXT_BUILD_ID is set by Next.js but only available at build time;
// inline as a constant during build.
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? Date.now().toString();

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    { version: BUILD_ID },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
