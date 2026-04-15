"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceApi, type WorkspaceMemberResponseDto } from "@/lib/api";
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

  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("AGENT");

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
    const ok = window.confirm("Remove this member from the workspace?");
    if (!ok) return;
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
    <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-4">
      {error ? (
        <div role="alert" className="alert alert-error alert-soft">
          <span className="text-sm">{error}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-base font-medium">Members</h2>
          <p className="text-sm text-base-content/70">
            Add members by <span className="font-mono">userId</span> (backend expects
            <span className="font-mono"> AddMemberDto.userId</span>).
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="form-control w-full sm:w-64">
            <div className="label">
              <span className="label-text">User ID</span>
            </div>
            <input
              className="input input-bordered w-full"
              placeholder="clx_user_123"
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              disabled={!canManage || inviteBusy}
            />
          </label>

          <label className="form-control w-full sm:w-40">
            <div className="label">
              <span className="label-text">Role</span>
            </div>
            <select
              className="select select-bordered w-full"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              disabled={!canManage || inviteBusy}
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
            className="btn btn-primary"
            onClick={onInvite}
            disabled={!canManage || inviteBusy || !inviteUserId.trim()}
          >
            {inviteBusy ? "Adding..." : "Add member"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table">
          <thead>
            <tr>
              <th className="text-xs font-medium text-base-content/60">User</th>
              <th className="text-xs font-medium text-base-content/60">Role</th>
              <th className="text-xs font-medium text-base-content/60 min-w-[12rem] max-w-[18rem]">
                Permissions
              </th>
              <th className="text-xs font-medium text-base-content/60">Status</th>
              <th className="text-right text-xs font-medium text-base-content/60">
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
                <tr key={member.id}>
                  <td className="text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {member.user?.email || member.user?.name || "Unknown"}
                      </span>
                      <span className="text-xs text-base-content/60">
                        memberId: <span className="font-mono">{member.id}</span>
                        {member.user?.id ? (
                          <>
                            {" "}
                            · userId:{" "}
                            <span className="font-mono">{member.user.id}</span>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </td>

                  <td className="text-sm">
                    {canManage ? (
                      <select
                        className="select select-bordered select-sm w-36"
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
                      <span className="badge badge-ghost">{member.role}</span>
                    )}
                  </td>

                  <td className="text-sm align-top">
                    <p
                      className="text-xs leading-snug text-base-content/80 line-clamp-3"
                      title={
                        rolePermissions.length
                          ? rolePermissions.join("\n")
                          : workspaceRolePermissionSummary(role)
                      }
                    >
                      {workspaceRolePermissionSummary(role)}
                    </p>
                  </td>

                  <td className="text-sm">
                    {member.isActive === false ? (
                      <span className="badge badge-warning badge-soft">inactive</span>
                    ) : (
                      <span className="badge badge-success badge-soft">active</span>
                    )}
                  </td>

                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onRemove(targetUserId, member.id)}
                      disabled={!canRemove || isBusy}
                    >
                      {isBusy ? "Working..." : "Remove"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

