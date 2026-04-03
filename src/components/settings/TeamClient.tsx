"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceApi, type WorkspaceMemberResponseDto } from "@/lib/api";
import type { WorkspaceRole } from "@/lib/types";

type MemberRow = {
  id: string;
  role: WorkspaceRole | string;
  joinedAt?: string;
  isActive?: boolean;
  user?: { id?: string; email?: string; name?: string | null };
};

const ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "AGENT"];

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
  const canManage = meRole === "OWNER" || meRole === "ADMIN";

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
    const rank = (r: string) => (r === "OWNER" ? 0 : r === "ADMIN" ? 1 : 2);
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

  const onChangeRole = async (memberId: string, role: WorkspaceRole) => {
    if (!canManage) return;
    setBusyId(memberId);
    setError(null);
    try {
      const updated = await workspaceApi.updateMemberRole(workspaceId, memberId, {
        role,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? normalizeMember(updated) : m))
      );
      refreshServerData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setBusyId(null);
    }
  };

  const onRemove = async (memberId: string) => {
    if (!canManage) return;
    const ok = window.confirm("Remove this member from the workspace?");
    if (!ok) return;
    setBusyId(memberId);
    setError(null);
    try {
      await workspaceApi.removeMember(workspaceId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
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
              <th className="text-xs font-medium text-base-content/60">Status</th>
              <th className="text-right text-xs font-medium text-base-content/60">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => {
              const isSelf = !!meUserId && member.user?.id === meUserId;
              const isBusy = busyId === member.id;
              const role = String(member.role) as WorkspaceRole;
              const canEditThisRole = canManage && !isBusy;
              const canRemove = canManage && !isSelf && role !== "OWNER";

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
                        value={ROLES.includes(role) ? role : "AGENT"}
                        onChange={(e) =>
                          onChangeRole(member.id, e.target.value as WorkspaceRole)
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
                      onClick={() => onRemove(member.id)}
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

