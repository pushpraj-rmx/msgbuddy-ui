/**
 * Native-fetch API client — no axios dependency.
 * Maintains the { data: T } response shape so all api.ts call sites are unchanged.
 */
import {
  getToken,
  clearToken,
  setAccessToken,
  DEFAULT_ACCESS_TOKEN_TTL_SEC,
} from "./auth";
import { API_BASE_URL, endpoints } from "./endpoints";

// ---------------------------------------------------------------------------
// Token refresh — shared between the ApiClient interceptor and fetchWithAuthRefresh
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { refreshSessionAction } = await import("@/app/actions/auth");
      const result = await refreshSessionAction();
      if (!result.success || !result.accessToken) {
        clearToken();
        return null;
      }
      setAccessToken(result.accessToken, {
        expiresInSeconds: result.expiresIn ?? DEFAULT_ACCESS_TOKEN_TTL_SEC,
      });
      return result.accessToken;
    })()
      .catch(() => {
        clearToken();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// ---------------------------------------------------------------------------
// fetchWithAuthRefresh — for binary/streaming calls (media uploads etc.)
// ---------------------------------------------------------------------------

/**
 * `fetch` with Bearer token + cookie credentials, with automatic 401 token refresh.
 * Use for binary uploads where the JSON client must not touch Content-Type.
 */
export async function fetchWithAuthRefresh(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers ?? undefined);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(url, { ...init, headers, credentials: "include" });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      if (typeof window !== "undefined") {
        clearToken();
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }
    headers.set("Authorization", `Bearer ${newToken}`);
    res = await fetch(url, { ...init, headers, credentials: "include" });
  }

  return res;
}

// ---------------------------------------------------------------------------
// ApiError — carries HTTP status + parsed body for callers that need it
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// ApiClient — drop-in replacement for axios.create()
// Returns { data: T } to match the axios response shape used throughout api.ts
// ---------------------------------------------------------------------------

interface RequestConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
  data?: unknown; // body for DELETE requests (axios convention)
  responseType?: "blob" | "json" | "text";
  headers?: Record<string, string>;
}

class ApiClient {
  constructor(private readonly baseURL: string) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildUrl(path: string, params?: Record<string, any>): string {
    const base = path.startsWith("http")
      ? path
      : `${this.baseURL}${path.startsWith("/") ? path : `/${path}`}`;

    if (!params) return base;

    const url = new URL(base);
    for (const [key, val] of Object.entries(params)) {
      if (val === undefined || val === null) continue;
      if (typeof val === "object") continue; // skip non-scalar values
      url.searchParams.set(key, String(val));
    }
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    config?: RequestConfig
  ): Promise<{ data: T }> {
    const url = this.buildUrl(path, config?.params);

    const extraHeaders: Record<string, string> = { ...(config?.headers ?? {}) };
    let reqBody: BodyInit | undefined;

    if (body instanceof FormData) {
      reqBody = body;
      // Let the browser set multipart/form-data + boundary automatically
      // (do NOT set Content-Type manually — it would omit the boundary)
      delete extraHeaders["Content-Type"];
    } else if (body !== undefined) {
      reqBody = JSON.stringify(body);
      extraHeaders["Content-Type"] = "application/json";
    }

    const res = await fetchWithAuthRefresh(url, {
      method,
      headers: extraHeaders,
      body: reqBody,
    });

    // 204 No Content or empty body
    const contentLength = res.headers.get("content-length");
    if (res.status === 204 || contentLength === "0") {
      return { data: undefined as T };
    }

    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");

    if (!res.ok) {
      let errData: unknown = undefined;
      try {
        errData = isJson ? await res.json() : await res.text();
      } catch {
        errData = res.statusText;
      }
      const message =
        typeof errData === "object" &&
        errData !== null &&
        "message" in errData &&
        typeof (errData as Record<string, unknown>).message === "string"
          ? (errData as { message: string }).message
          : `Request failed (${res.status})`;
      throw new ApiError(message, res.status, errData);
    }

    if (config?.responseType === "blob") {
      const data = (await res.blob()) as T;
      return { data };
    }

    if (!isJson) {
      return { data: undefined as T };
    }

    const data = (await res.json()) as T;
    return { data };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get<T = any>(path: string, config?: RequestConfig): Promise<{ data: T }> {
    return this.request<T>("GET", path, undefined, config);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<T = any>(
    path: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<{ data: T }> {
    return this.request<T>("POST", path, body, config);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put<T = any>(
    path: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<{ data: T }> {
    return this.request<T>("PUT", path, body, config);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<T = any>(
    path: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<{ data: T }> {
    return this.request<T>("PATCH", path, body, config);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete<T = any>(
    path: string,
    config?: RequestConfig
  ): Promise<{ data: T }> {
    // axios passes DELETE body via config.data
    return this.request<T>("DELETE", path, config?.data, config);
  }
}

const api = new ApiClient(API_BASE_URL);
export default api;
