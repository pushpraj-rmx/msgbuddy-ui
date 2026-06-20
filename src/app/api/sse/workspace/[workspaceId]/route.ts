import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { API_BASE_URL, endpoints } from "@/lib/endpoints";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";
import { refreshAuthTokensOnce } from "@/lib/auth-refresh";
import { parseJwtExpMs } from "@/lib/jwt";

/**
 * SSE proxy auth strategy: prefer the existing access token even if it's
 * near-expiry. The upstream Nest connection only auths once at setup; once
 * established the stream survives until disconnect. If the token is *fully
 * expired* we fall back to refresh, but otherwise we let `SessionRefresh`
 * (the proactive client-side refresher) own the rotation. Without this,
 * every concurrent EventSource that opens within the grace window competes
 * for `/auth/refresh` and (under PM2 cluster) races with itself, invalidating
 * the refresh-token chain → user gets logged out.
 */
async function getOrRefreshAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const token = raw ? decodeURIComponent(raw) : null;
  if (token) {
    const expMs = parseJwtExpMs(token);
    // Use the token as long as it isn't already expired.
    if (expMs && expMs > Date.now()) return token;
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
