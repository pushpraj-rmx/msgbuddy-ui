import { API_BASE_URL } from "./endpoints";

/**
 * Base URL for API routes, used to resolve stored path-absolute media URLs.
 *
 * `NEXT_PUBLIC_API_URL` should be your API origin (e.g. `https://api.msgbuddy.com`), not the
 * app origin (`https://app.msgbuddy.com`). Uploads are served at **`GET /v2/uploads/...`**
 * on that API host, not at `/uploads/...` on the Next app.
 */
function apiBaseForMediaPaths(): string {
  let b = API_BASE_URL.trim().replace(/\/$/, "");
  if (/\/api$/i.test(b)) {
    return b;
  }
  if (!/\/v2$/i.test(b)) {
    b = `${b}/v2`;
  }
  return b;
}

/**
 * Resolve message `mediaUrl` snapshots for `<img src>`.
 *
 * Stored values are often path-absolute (`/uploads/<workspaceId>/...`). Used as-is in the
 * browser they resolve against the **Next origin** → 404. We resolve against the API base
 * so the request hits `https://<api-host>/v2/uploads/...`.
 *
 * Uses a **relative** path segment (no leading `/`) with `new URL(..., apiBase + '/')` so
 * the `/api` prefix is preserved; `new URL('/uploads/...', 'https://host/')` would incorrectly
 * drop `/api` and request `https://host/uploads/...`.
 */
export function resolveMediaUrlForUi(
  url: string | null | undefined
): string | undefined {
  if (url == null || typeof url !== "string") return undefined;
  const u = url.trim();
  if (!u) return undefined;
  if (u.startsWith("https://") || u.startsWith("http://")) return u;
  if (u.startsWith("//")) {
    try {
      return new URL(`https:${u}`).href;
    } catch {
      return undefined;
    }
  }

  // Backend often stores full API paths like `/v2/media/public?...`. Resolving `v2/...`
  // against base `.../v2/` incorrectly yields `.../v2/v2/...` (404). Anchor at API origin.
  if (u.startsWith("/v2/")) {
    try {
      const origin = new URL(API_BASE_URL.trim().replace(/\/$/, "")).origin;
      return new URL(u, `${origin}/`).href;
    } catch {
      /* fall through */
    }
  }

  const apiBase = apiBaseForMediaPaths();
  const relative = u.startsWith("/") ? u.slice(1) : u;

  try {
    return new URL(relative, `${apiBase}/`).href;
  } catch {
    return `${apiBase}/${relative}`;
  }
}
