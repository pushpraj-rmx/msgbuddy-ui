const ACCESS_TOKEN_KEY = "access_token";
export const ACCESS_TOKEN_COOKIE = "msgbuddy_access_token";
export const REFRESH_TOKEN_COOKIE = "msgbuddy_refresh_token";

let inMemoryAccessToken: string | null = null;

export const getToken = (): string | null => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof window !== "undefined") {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return null;
};

export const setAccessToken = (
  token: string | null,
  options?: { expiresInSeconds?: number }
): void => {
  inMemoryAccessToken = token;
  if (typeof window === "undefined") return;

  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    const maxAge = options?.expiresInSeconds
      ? `;Max-Age=${options.expiresInSeconds}`
      : "";
    const secure = window.location.protocol === "https:" ? ";Secure" : "";
    document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(
      token
    )};Path=/;SameSite=Lax${secure}${maxAge}`;
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    document.cookie = `${ACCESS_TOKEN_COOKIE}=;Path=/;Max-Age=0;SameSite=Lax`;
  }
};

export const clearToken = (): void => {
  setAccessToken(null);
};

export const hasToken = (): boolean => {
  return getToken() !== null;
};
