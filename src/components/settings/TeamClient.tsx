"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";
import { workspaceApi, type WorkspaceMemberResponseDto } from "@/lib/api";
import {
  permissionsForWorkspaceRole,
  roleHasWorkspacePermission,
  workspaceRolePermissionSummary,
} from "@/lib/workspace-role-permissions";
import type { WorkspaceRole } from "@/lib/types";
import { InfoTip } from "@/components/ui/InfoTip";

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

  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("AGENT");
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; rowId: string } | null>(null);

  const sorted = useMemo(() => {
    const copy = [...members];
    const rank = (r: string) => ROLE_SORT_RANK[r] ?? 99;
    copy.sort((a, b) => rank(String(a.role)) - rank(String(b.role)));
    return copy;
  }, [members]);

  const refreshServerData = () => router.refresh();

  const onInvite = async () => {
    if (!canManage) return;
    const userId = inviteUserId.trim();
    if (!userId) return;
    setInviteBusy(true);
    setError(null);
    try {
      const created = await workspaceApi.addMember(workspaceId, {
        userId,
        role: inviteRole,
      });
      setMembers((prev) => {
        const next = prev.filter((m) => m.id !== created.id);
        next.unshift(normalizeMember(created));
        return next;
      });
      setInviteUserId("");
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
          <p className="text-[13px]">{error}</p>
        </div>
      ) : null}

      {canManage && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="form-control flex-1 min-w-[180px] max-w-xs">
            <span className="op-label mb-1 flex items-center gap-1.5">
              User ID
              <InfoTip tip="Find user IDs in Platform → Users, or ask the user for their account email" />
            </span>
            <input
              className="input input-bordered input-sm w-full font-mono"
              placeholder="clx_user_123"
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              disabled={inviteBusy}
            />
          </label>

          <label className="form-control w-28">
            <span className="op-label mb-1">Role</span>
            <select
              className="select select-bordered select-sm w-full"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              disabled={inviteBusy}
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
            disabled={inviteBusy || !inviteUserId.trim()}
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
        </div>
      )}

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
        <table className="w-full text-[12.5px]">
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
                    <span className="text-[13px] font-medium block">
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
                      className="text-[11px] leading-snug text-base-content/55 line-clamp-2"
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

