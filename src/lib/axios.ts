import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from "axios";
import { getToken, clearToken, setAccessToken } from "./auth";
import { API_BASE_URL, endpoints } from "./endpoints";

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh uses a server action so the httpOnly refresh cookie (Next origin) can be read
 * and sent as `{ refreshToken }` to the API — browser cannot attach it to cross-origin
 * requests by itself.
 */
const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { refreshSessionAction } = await import("@/app/actions/auth");
      const result = await refreshSessionAction();
      if (!result.success || !result.accessToken) {
        clearToken();
        return null;
      }
      setAccessToken(result.accessToken, {
        expiresInSeconds: result.expiresIn,
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
};

/**
 * `fetch` with Bearer token + cookie credentials, mirroring the axios client’s 401 refresh.
 * Use for binary uploads where axios defaults must not touch the body or Content-Type.
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

// Request interceptor to attach token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetriableConfig | undefined;
    const isRefreshCall = originalRequest?.url?.includes(endpoints.auth.refresh);

    if (status === 401 && !isRefreshCall && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();

      if (newToken) {
        const headers = AxiosHeaders.from(originalRequest.headers || {});
        headers.set("Authorization", `Bearer ${newToken}`);
        originalRequest.headers = headers;
        return api(originalRequest);
      }

      if (typeof window !== "undefined") {
        clearToken();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
