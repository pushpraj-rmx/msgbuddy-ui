import { API_BASE_URL } from "./endpoints";
import { ACCESS_TOKEN_COOKIE } from "./auth";
import { refreshAuthTokensOnce } from "./auth-refresh";

async function refreshServerAccessToken(): Promise<string | null> {
  const payload = await refreshAuthTokensOnce();
  return payload?.accessToken ?? null;
}

/** RSC / server-only data loading with cookie auth and shared refresh mutex. */
export async function serverFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const token = raw ? decodeURIComponent(raw) : null;

  const doRequest = async (bearer: string | null) => {
    const headers = new Headers(init.headers ?? undefined);
    if (bearer) {
      headers.set("Authorization", `Bearer ${bearer}`);
    } else {
      headers.delete("Authorization");
    }
    if (init.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      credentials: "include",
    });
  };

  let response = await doRequest(token);

  if (response.status === 401) {
    const refreshed = await refreshServerAccessToken();
    if (refreshed) {
      response = await doRequest(refreshed);
    } else {
      redirect("/login");
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}
