"use server";

import { cookies } from "next/headers";
import type { AuthResponse } from "@/lib/api";
import { API_BASE_URL, endpoints } from "@/lib/endpoints";
import {
  ACCESS_TOKEN_COOKIE,
  DEFAULT_ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth";
import { refreshAuthTokensOnce } from "@/lib/auth-refresh";

const setAuthCookies = async ({
  accessToken,
  refreshToken,
  expiresIn,
}: AuthResponse) => {
  const cookieStore = await cookies();
  const maxAge = expiresIn ?? DEFAULT_ACCESS_TOKEN_TTL_SEC;

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  });

  if (refreshToken) {
    cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
};

/** Exchange httpOnly refresh cookie for new tokens (used by client axios after 401). */
export async function refreshSessionAction(): Promise<
  | { success: true; accessToken: string; expiresIn?: number }
  | { success: false }
> {
  const payload = await refreshAuthTokensOnce();
  if (!payload?.accessToken) {
    return { success: false };
  }
  return {
    success: true,
    accessToken: payload.accessToken,
    expiresIn: payload.expiresIn,
  };
}

export async function loginAction(email: string, password: string) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoints.auth.login}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.message || "Login failed" };
    }

    const payload = (await response.json()) as AuthResponse;
    await setAuthCookies(payload);

    return {
      success: true,
      accessToken: payload.accessToken,
      expiresIn: payload.expiresIn,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Login failed",
    };
  }
}

export async function registerAction(
  email: string,
  password: string,
  workspace: string
) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoints.auth.register}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, workspace }),
      credentials: "include",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.message || "Registration failed" };
    }

    const payload = (await response.json()) as AuthResponse;
    await setAuthCookies(payload);

    return {
      success: true,
      accessToken: payload.accessToken,
      expiresIn: payload.expiresIn,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Registration failed",
    };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  try {
    await fetch(`${API_BASE_URL}${endpoints.auth.logout}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: accessToken ? `Bearer ${accessToken}` : "",
      },
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
    });
  } catch {
    // Ignore logout errors; proceed with local cleanup
  }

  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  return { success: true };
}
