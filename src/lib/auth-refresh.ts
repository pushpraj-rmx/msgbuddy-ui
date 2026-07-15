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
 * forces re-login.
 *
 * The map is a module-level singleton shared across every request in this Next.js
 * server process, so it MUST be keyed by the caller's refresh token. Keying by
 * nothing (a single shared promise) would hand one user the rotated tokens minted
 * for a different user whose refresh happened to be in flight — a cross-account
 * session leak. Same refresh token → same in-flight promise (real single-flight);
 * different users → independent promises.
 */
const refreshInFlightByToken = new Map<
  string,
  Promise<RefreshPayload | null>
>();

export async function refreshAuthTokensOnce(): Promise<RefreshPayload | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return null;

  const existing = refreshInFlightByToken.get(refreshToken);
  if (existing) return existing;

  const inFlight = (async () => {
    try {
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
    refreshInFlightByToken.delete(refreshToken);
  });

  refreshInFlightByToken.set(refreshToken, inFlight);
  return inFlight;
}
