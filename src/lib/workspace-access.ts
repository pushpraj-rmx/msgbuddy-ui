/**
 * Client-side nav and feature gates aligned with backend ROLE_PERMISSIONS
 * (msgbuddy-v2/src/auth/permissions.ts). Keep wire strings in sync when roles change.
 */

function R(workspaceRole: string): string {
  return String(workspaceRole).toUpperCase();
}

/** `campaigns.create` | `campaigns.start` | `campaigns.delete` — OWNER, ADMIN only. */
export function canAccessCampaigns(workspaceRole: string): boolean {
  const r = R(workspaceRole);
  return r === "OWNER" || r === "ADMIN";
}

/** `templates.view` — all roles except VIEWER. */
export function canViewTemplates(workspaceRole: string): boolean {
  return R(workspaceRole) !== "VIEWER";
}

/** `analytics.view` — OWNER, ADMIN, SUPERVISOR, AUDITOR. */
export function canAccessAnalyticsNav(workspaceRole: string): boolean {
  const r = R(workspaceRole);
  return (
    r === "OWNER" ||
    r === "ADMIN" ||
    r === "SUPERVISOR" ||
    r === "AUDITOR"
  );
}

/** Usage snapshot — restrict to OWNER and ADMIN (operational / billing-adjacent). */
export function canAccessUsagePage(workspaceRole: string): boolean {
  const r = R(workspaceRole);
  return r === "OWNER" || r === "ADMIN";
}
