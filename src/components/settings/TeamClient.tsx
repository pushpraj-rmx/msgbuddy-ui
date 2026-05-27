"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Link as LinkIcon, X as XIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";
import {
  workspaceApi,
  workspaceInvitationsApi,
  type WorkspaceInvitation,
  type WorkspaceMemberResponseDto,
} from "@/lib/api";
import {
  permissionsForWorkspaceRole,
  roleHasWorkspacePermission,
  workspaceRolePermissionSummary,
} from "@/lib/workspace-role-permissions";
import type { WorkspaceRole } from "@/lib/types";

type MemberRow = {
  id: string;
  role: WorkspaceRole | string;
  joinedAt?: string;
  isActive?: boolean;
  user?: { id?: string; email?: string; name?: string | null };
};

const ROLES: WorkspaceRole[] = [
  "OWNER",
  "ADMIN",
  "SUPERVISOR",
  "AGENT",
  "AUDITOR",
  "VIEWER",
];

const ROLE_SORT_RANK: Record<string, number> = {
  OWNER: 0,
  ADMIN: 1,
  SUPERVISOR: 2,
  AGENT: 3,
  AUDITOR: 4,
  VIEWER: 5,
};

function normalizeMember(m: WorkspaceMemberResponseDto | MemberRow): MemberRow {
  return {
    id: m.id,
    role: m.role,
    joinedAt: "joinedAt" in m ? m.joinedAt : undefined,
    isActive: "isActive" in m ? m.isActive : undefined,
    user: m.user,
  };
}

export function TeamClient({
  workspaceId,
  initialMembers,
  meRole,
  meUserId,
}: {
  workspaceId: string;
  initialMembers: MemberRow[];
  meRole: string;
  meUserId?: string;
}) {
  const router = useRouter();
  const canManage = roleHasWorkspacePermission(meRole, "members.manage");

  const [members, setMembers] = useState<MemberRow[]>(
    initialMembers.map(normalizeMember)
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("AGENT");
  const [inviteHint, setInviteHint] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; rowId: string } | null>(null);

  // Invitations list (admin-only). Loaded lazily on mount when the caller
  // can manage members; refreshed after every create/revoke.
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshInvitations = useCallback(async () => {
    if (!canManage) return;
    setInvitationsLoading(true);
    try {
      const list = await workspaceInvitationsApi.list();
      setInvitations(list);
    } catch {
      // non-fatal
    } finally {
      setInvitationsLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void refreshInvitations();
  }, [refreshInvitations]);

  const acceptUrlFor = (token: string) => {
    if (typeof window === "undefined") return `/accept-invite?token=${token}`;
    return `${window.location.origin}/accept-invite?token=${token}`;
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      window.setTimeout(() => setCopiedId((k) => (k === key ? null : k)), 1500);
    } catch {
      // ignored — user can still select + copy manually
    }
  };

  const onGenerateLink = async () => {
    setLinkBusy(true);
    setError(null);
    try {
      const created = await workspaceInvitationsApi.create({
        role: inviteRole,
        ...(inviteEmail.trim() ? { email: inviteEmail.trim() } : {}),
      });
      setInvitations((prev) => [created, ...prev]);
      setInviteHint(null);
      await copyToClipboard(acceptUrlFor(created.token), created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate link");
    } finally {
      setLinkBusy(false);
    }
  };

  const onRevokeInvitation = async (id: string) => {
    try {
      const updated = await workspaceInvitationsApi.revoke(id);
      setInvitations((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke invitation");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...members];
    const rank = (r: string) => ROLE_SORT_RANK[r] ?? 99;
    copy.sort((a, b) => rank(String(a.role)) - rank(String(b.role)));
    return copy;
  }, [members]);

  const refreshServerData = () => router.refresh();

  const onInvite = async () => {
    if (!canManage) return;
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteBusy(true);
    setError(null);
    setInviteHint(null);
    try {
      const res = await workspaceApi.addMemberByEmail(workspaceId, {
        email,
        role: inviteRole,
      });
      if (res.status === "no-account") {
        // Common case: the teammate hasn't registered yet. Surface a clear
        // hint pointing at the invite-link affordance — admin can click
        // "Generate link" right below to copy a URL to share manually.
        setInviteHint(
          `No MsgBuddy account found for ${res.email}. Generate an invite link below and share it with them — they can sign up via the link.`,
        );
        return;
      }
      setMembers((prev) => {
        const next = prev.filter((m) => m.id !== res.member.id);
        next.unshift(normalizeMember(res.member));
        return next;
      });
      setInviteEmail("");
      setInviteRole("AGENT");
      refreshServerData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setInviteBusy(false);
    }
  };

  const onChangeRole = async (targetUserId: string, rowId: string, role: WorkspaceRole) => {
    if (!canManage || !targetUserId) return;
    setBusyId(rowId);
    setError(null);
    try {
      const updated = await workspaceApi.updateMemberRole(workspaceId, targetUserId, {
        role,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === rowId ? normalizeMember(updated) : m))
      );
      refreshServerData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setBusyId(null);
    }
  };

  const onRemove = async (targetUserId: string, rowId: string) => {
    if (!canManage || !targetUserId) return;
    setBusyId(rowId);
    setError(null);
    try {
      await workspaceApi.removeMember(workspaceId, targetUserId);
      setMembers((prev) => prev.filter((m) => m.id !== rowId));
      refreshServerData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-box border border-base-300 bg-base-200 p-4 sm:p-5 space-y-4">
      {error ? (
        <div role="alert" className="rounded-box border-l-2 border border-error/30 border-l-error bg-base-100 px-4 py-3">
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem]">{error}</p>
        </div>
      ) : null}

      {canManage && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="form-control flex-1 min-w-[220px] max-w-md">
              <span className="op-label mb-1">Email</span>
              <input
                type="email"
                className="input input-bordered input-sm w-full"
                placeholder="agent@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviteBusy || linkBusy}
              />
            </label>

            <label className="form-control w-28">
              <span className="op-label mb-1">Role</span>
              <select
                className="select select-bordered select-sm w-full"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                disabled={inviteBusy || linkBusy}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onInvite}
              disabled={inviteBusy || linkBusy || !inviteEmail.trim()}
              title="If they have an account, they're added immediately."
            >
              {inviteBusy ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Adding…
                </>
              ) : (
                "Add"
              )}
            </button>

            <button
              type="button"
              className="btn btn-outline btn-sm gap-1"
              onClick={onGenerateLink}
              disabled={inviteBusy || linkBusy}
              title="Create a shareable link; copy and send via WhatsApp/email. No account required up-front."
            >
              <LinkIcon className="h-3.5 w-3.5" aria-hidden />
              {linkBusy ? "Generating…" : "Generate invite link"}
            </button>
          </div>

          {inviteHint ? (
            <div
              role="status"
              className="rounded-box border border-info/30 border-l-2 border-l-info bg-base-100 px-3 py-2 text-[0.8125rem]"
            >
              {inviteHint}
            </div>
          ) : null}

          {invitations.length > 0 ? (
            <div className="rounded-box border border-base-300 bg-base-100">
              <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
                <span className="op-label">Invitations</span>
                {invitationsLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
              </div>
              <ul className="divide-y divide-base-300">
                {invitations.map((inv) => {
                  const expired =
                    !inv.acceptedAt &&
                    !inv.revokedAt &&
                    new Date(inv.expiresAt).getTime() <= Date.now();
                  const status = inv.acceptedAt
                    ? "accepted"
                    : inv.revokedAt
                      ? "revoked"
                      : expired
                        ? "expired"
                        : "pending";
                  const url = acceptUrlFor(inv.token);
                  return (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-center gap-2 px-3 py-2 text-[0.8125rem]"
                    >
                      <span
                        className={`shrink-0 rounded-[3px] border px-1.5 py-[1px] font-mono-op text-[0.625rem] uppercase tracking-[0.04em] ${
                          status === "pending"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : status === "accepted"
                              ? "border-success/40 bg-success/10 text-success"
                              : status === "revoked"
                                ? "border-base-content/30 bg-base-200 text-base-content/55"
                                : "border-warning/40 bg-warning/10 text-warning"
                        }`}
                      >
                        {status}
                      </span>
                      <span className="font-mono-op text-[0.6875rem] text-base-content/70">
                        {inv.role}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-base-content/80">
                        {inv.email || (
                          <span className="text-base-content/50">
                            blank link
                          </span>
                        )}
                      </span>
                      <span className="font-mono-op text-[0.625rem] tabular-nums text-base-content/45">
                        expires{" "}
                        {new Date(inv.expiresAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {status === "pending" ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs gap-1"
                            onClick={() => copyToClipboard(url, inv.id)}
                            title="Copy invite URL"
                          >
                            <Copy className="h-3 w-3" aria-hidden />
                            {copiedId === inv.id ? "Copied!" : "Copy"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error/70 hover:text-error"
                            onClick={() => onRevokeInvitation(inv.id)}
                            title="Revoke"
                          >
                            <XIcon className="h-3 w-3" aria-hidden />
                          </button>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
        <table className="w-full text-[0.78125rem]">
          <thead>
            <tr className="border-b border-base-300 bg-base-100">
              <th className="op-label px-3 py-2.5 text-left font-medium">User</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Role</th>
              <th className="op-label min-w-[12rem] max-w-[18rem] px-3 py-2.5 text-left font-medium">
                Permissions
              </th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Status</th>
              <th className="op-label px-3 py-2.5 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => {
              const targetUserId = member.user?.id ?? "";
              const isSelf = !!meUserId && targetUserId === meUserId;
              const isBusy = busyId === member.id;
              const role = String(member.role) as WorkspaceRole;
              const rolePermissions = permissionsForWorkspaceRole(role);
              const canEditThisRole =
                canManage && !isBusy && !!targetUserId;
              const canRemove =
                canManage && !isSelf && role !== "OWNER" && !!targetUserId;

              return (
                <tr key={member.id} className="border-b border-base-300 last:border-b-0">
                  <td className="px-3 py-2.5 align-top">
                    <span className="text-[0.8125rem] font-medium block">
                      {member.user?.email || member.user?.name || "Unknown"}
                    </span>
                    {isSelf && <span className="op-tag op-tag-info ml-1">you</span>}
                  </td>

                  <td className="px-3 py-2.5 align-top">
                    {canManage ? (
                      <select
                        className="select select-bordered select-xs w-28"
                        value={ROLES.includes(role as WorkspaceRole) ? role : "AGENT"}
                        onChange={(e) =>
                          onChangeRole(
                            targetUserId,
                            member.id,
                            e.target.value as WorkspaceRole
                          )
                        }
                        disabled={!canEditThisRole || role === "OWNER"}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="op-tag">{member.role}</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 align-top min-w-[12rem] max-w-[18rem]">
                    <p
                      className="text-[0.6875rem] leading-snug text-base-content/55 line-clamp-2"
                      title={
                        rolePermissions.length
                          ? rolePermissions.join("\n")
                          : workspaceRolePermissionSummary(role)
                      }
                    >
                      {workspaceRolePermissionSummary(role)}
                    </p>
                  </td>

                  <td className="px-3 py-2.5 align-top">
                    {member.isActive === false ? (
                      <span className="op-tag op-tag-warn">inactive</span>
                    ) : (
                      <span className="op-tag op-tag-ok">active</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-right align-top">
                    {canRemove ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error/70 hover:text-error"
                        onClick={() => setConfirmRemove({ userId: targetUserId, rowId: member.id })}
                        disabled={isBusy}
                      >
                        {isBusy ? <span className="loading loading-spinner loading-xs" /> : "Remove"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove member"
        description="Remove this member from the workspace?"
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => {
          if (confirmRemove) {
            onRemove(confirmRemove.userId, confirmRemove.rowId);
          }
          setConfirmRemove(null);
        }}
        onClose={() => setConfirmRemove(null)}
      />
    </div>
  );
}

