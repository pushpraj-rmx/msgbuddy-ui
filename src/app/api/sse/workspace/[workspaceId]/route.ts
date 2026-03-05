import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { API_BASE_URL, endpoints } from "@/lib/endpoints";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const resolvedParams = await params;
  const raw = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  const token = raw ? decodeURIComponent(raw) : null;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const upstream = await fetch(
    `${API_BASE_URL}${endpoints.sse.workspace(resolvedParams.workspaceId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
    }
  );

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { message: "Unable to connect to event stream." },
      { status: upstream.status || 500 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
