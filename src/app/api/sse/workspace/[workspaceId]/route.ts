import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { API_BASE_URL, endpoints } from "@/lib/endpoints";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth";

async function getOrRefreshAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const token = raw ? decodeURIComponent(raw) : null;
  if (token) return token;

  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}${endpoints.auth.refresh}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
    };
    if (!payload.accessToken) return null;

    const maxAge = payload.expiresIn ?? 15 * 60;
    cookieStore.set(ACCESS_TOKEN_COOKIE, payload.accessToken, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });
    if (payload.refreshToken) {
      cookieStore.set(REFRESH_TOKEN_COOKIE, payload.refreshToken, {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    return payload.accessToken;
  } catch {
    return null;
  }
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
