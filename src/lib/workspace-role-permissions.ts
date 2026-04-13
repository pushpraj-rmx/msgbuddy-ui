/**
 * Wire permission strings per workspace role.
 * MUST stay in sync with msgbuddy-v2/src/auth/permissions.ts (ROLE_PERMISSIONS).
 * When changing roles or grants, update both files and docs/WORKSPACE_PERMISSIONS.md.
 */
import type { WorkspaceRole } from "./types";

const OWNER_PERMISSIONS: readonly string[] = [
  "conversations.view",
  "conversations.assign",
  "messages.read",
  "messages.send",
  "contacts.view",
  "contacts.create",
  "contacts.delete",
  "contacts.import",
  "contacts.export",
  "media.read",
  "media.write",
  "campaigns.create",
  "campaigns.start",
  "campaigns.delete",
  "templates.create",
  "templates.approve",
  "templates.sync",
  "templates.view",
  "members.manage",
  "members.view",
  "settings.manage",
  "analytics.view",
  "analytics.export",
];

const ADMIN_PERMISSIONS: readonly string[] = [...OWNER_PERMISSIONS];

const SUPERVISOR_PERMISSIONS: readonly string[] = [
  "conversations.view",
  "conversations.assign",
  "messages.read",
  "messages.send",
  "contacts.view",
  "contacts.create",
  "media.read",
  "media.write",
  "templates.view",
  "templates.sync",
  "analytics.view",
  "members.view",
];

const AGENT_PERMISSIONS: readonly string[] = [
  "conversations.view",
  "messages.read",
  "messages.send",
  "contacts.view",
  "contacts.create",
  "media.read",
  "media.write",
  "templates.view",
];

const AUDITOR_PERMISSIONS: readonly string[] = [
  "conversations.view",
  "messages.read",
  "contacts.view",
  "contacts.export",
  "media.read",
  "templates.view",
  "analytics.view",
  "analytics.export",
  "members.view",
];

const VIEWER_PERMISSIONS: readonly string[] = [
  "conversations.view",
  "messages.read",
  "contacts.view",
  "media.read",
];

const BY_ROLE: Record<WorkspaceRole, readonly string[]> = {
  OWNER: OWNER_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  SUPERVISOR: SUPERVISOR_PERMISSIONS,
  AGENT: AGENT_PERMISSIONS,
  AUDITOR: AUDITOR_PERMISSIONS,
  VIEWER: VIEWER_PERMISSIONS,
};

export function permissionsForWorkspaceRole(role: string): readonly string[] {
  const r = role as WorkspaceRole;
  return r in BY_ROLE ? BY_ROLE[r] : [];
}

/** Check a wire permission string (e.g. `settings.manage`) for a role label. */
export function roleHasWorkspacePermission(
  role: string,
  permissionWire: string,
): boolean {
  return permissionsForWorkspaceRole(role).includes(permissionWire);
}

export function workspaceRolePermissionSummary(role: string): string {
  const r = role as WorkspaceRole;
  if (r === "OWNER") {
    return "Full workspace permissions (incl. billing-adjacent controls, team management, settings).";
  }
  if (r === "ADMIN") {
    return "Same operational scope as owner (incl. team and settings); workspace deletion remains owner-only in product rules.";
  }
  if (r === "SUPERVISOR") {
    return "Oversight: inbox, assign, messaging, contacts (create), media, templates (view/sync), analytics, member list — no campaigns, template authoring, or settings.";
  }
  if (r === "AGENT") {
    return "Operational: conversations, messaging, contacts (view/create), media, template catalog (view) — no assign-to-others, analytics, or team list.";
  }
  if (r === "AUDITOR") {
    return "Read-heavy: conversations, contacts (incl. export), media read, templates (view), analytics (incl. export), member list — no sends or mutations.";
  }
  if (r === "VIEWER") {
    return "Read-only: conversations, contacts, media read — narrow visibility for stakeholders.";
  }
  return "—";
}
