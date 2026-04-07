import { API_BASE_URL, endpoints } from "@/lib/endpoints";

/** Full URL to start Google OAuth (GET; API responds with redirects). */
export function getGoogleAuthStartUrl(): string {
  return `${API_BASE_URL}${endpoints.auth.googleStart}`;
}
