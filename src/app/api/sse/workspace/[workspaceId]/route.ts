import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { API_BASE_URL, endpoints } from "@/lib/endpoints";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";
import { refreshAuthTokensOnce } from "@/lib/auth-refresh";
import { parseJwtExpMs } from "@/lib/jwt";

const SSE_GRACE_MS = 30_000;

async function getOrRefreshAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const token = raw ? decodeURIComponent(raw) : null;
  if (token) {
    const expMs = parseJwtExpMs(token);
    if (expMs && expMs > Date.now() + SSE_GRACE_MS) return token;
  }

  const payload = await refreshAuthTokensOnce();
  return payload?.accessToken ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const resolvedParams = await params;
  const token = await getOrRefreshAccessToken();

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = `${API_BASE_URL}${endpoints.sse.workspace(resolvedParams.workspaceId)}`;

  const upstream = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    signal: _request.signal,
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { message: "Unable to connect to event stream." },
      { status: upstream.status || 500 },
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
