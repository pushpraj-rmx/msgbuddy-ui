export const ACCESS_TOKEN_COOKIE = "msgbuddy_access_token";
export const REFRESH_TOKEN_COOKIE = "msgbuddy_refresh_token";

/** Matches API default access TTL when `expiresIn` is omitted (see auth actions / auth-refresh). */
export const DEFAULT_ACCESS_TOKEN_TTL_SEC = 15 * 60;

let inMemoryAccessToken: string | null = null;

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export const getToken = (): string | null => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof window !== "undefined") {
    return readCookie(ACCESS_TOKEN_COOKIE);
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
    const maxAgeSec = options?.expiresInSeconds ?? DEFAULT_ACCESS_TOKEN_TTL_SEC;
    const maxAge = `;Max-Age=${maxAgeSec}`;
    const secure = window.location.protocol === "https:" ? ";Secure" : "";
    document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(
      token
    )};Path=/;SameSite=Lax${secure}${maxAge}`;
  } else {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=;Path=/;Max-Age=0;SameSite=Lax`;
  }
};

export const clearToken = (): void => {
  setAccessToken(null);
};

export const hasToken = (): boolean => {
  return getToken() !== null;
};
