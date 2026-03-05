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

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post(endpoints.auth.refresh)
      .then((res) => {
        const { accessToken, expiresIn } = res.data || {};
        if (!accessToken) throw new Error("Missing access token");
        setAccessToken(accessToken, { expiresInSeconds: expiresIn });

        // If backend returns rotated refreshToken, let browser store it via Set-Cookie;
        // no JS access here because it should be HttpOnly.
        return accessToken as string;
      })
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
