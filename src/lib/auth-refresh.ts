import { cookies } from "next/headers";
import { API_BASE_URL, endpoints } from "./endpoints";
import {
  ACCESS_TOKEN_COOKIE,
  DEFAULT_ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_COOKIE,
} from "./auth";

type RefreshPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
};

/**
 * Single-flight refresh: the API rotates refresh tokens (one DB row per refresh),
 * so concurrent POST /auth/refresh with the same cookie invalidates the loser and
 * forces re-login. All server-side refresh entry points must share this mutex.
 */
let refreshInFlight: Promise<RefreshPayload | null> | null = null;

export async function refreshAuthTokensOnce(): Promise<RefreshPayload | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
        if (!refreshToken) return null;

        const response = await fetch(`${API_BASE_URL}${endpoints.auth.refresh}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
          credentials: "include",
        });

        if (!response.ok) return null;

        const payload = (await response.json()) as Partial<RefreshPayload>;
        if (!payload.accessToken) return null;

        const maxAge = payload.expiresIn ?? DEFAULT_ACCESS_TOKEN_TTL_SEC;
        if (typeof cookieStore.set === "function") {
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
        }

        return {
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken ?? "",
          expiresIn: payload.expiresIn,
        };
      } catch {
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
