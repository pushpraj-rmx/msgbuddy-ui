import type { PlatformRole } from "./types";

export function canAccessPlatform(role: PlatformRole | string | undefined): boolean {
  return role === "SUPERADMIN" || role === "SUPPORT";
}

export function isSuperAdmin(role: PlatformRole | string | undefined): boolean {
  return role === "SUPERADMIN";
}
