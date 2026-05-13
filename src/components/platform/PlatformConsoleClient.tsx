"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  useAssignChannelAccount,
  useChannelAccounts,
  useConnectedClientBusinesses,
  usePlatformAuditLogs,
  usePlatformUsageEvents,
  usePlatformUser,
  usePlatformUserLoginHistory,
  usePlatformUsers,
  usePlatformWebhookLogs,
  usePlatformWorkspace,
  usePlatformWorkspaces,
  useReactivateWorkspace,
  useSuspendWorkspace,
  useUpdatePlatformRole,
} from "@/hooks/use-platform";
import { isSuperAdmin } from "@/lib/platform-access";
import type { PlatformRole, PlatformWorkspaceStatus } from "@/lib/types";
import { getApiError } from "@/lib/api-error";

type TabKey =
  | "workspaces"
  | "users"
  | "webhookLogs"
  | "usageEvents"
  | "auditLogs"
  | "channelAccounts"
  | "connectedClientBusinesses";

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

const WORKSPACE_STATUSES: PlatformWorkspaceStatus[] = [
  "ACTIVE",
  "TRIAL",
  "SUSPENDED",
  "CANCELLED",
  "DELETED",
];

const PLATFORM_ROLES: PlatformRole[] = ["SUPERADMIN", "SUPPORT", "NONE"];

export function PlatformConsoleClient({
  platformRole,
}: {
  platformRole: PlatformRole | string;
}) {
  const superAdmin = isSuperAdmin(platformRole);
  const tabs = useMemo(
    () =>
      superAdmin
        ? ([
            { key: "workspaces", label: "Workspaces" },
            { key: "users", label: "Users" },
            { key: "webhookLogs", label: "Webhook Logs" },
            { key: "usageEvents", label: "Usage Events" },
            { key: "channelAccounts", label: "Channel Accounts" },
            {
              key: "connectedClientBusinesses",
              label: "Client Businesses",
            },
          ] as Array<{ key: TabKey; label: string }>)
        : ([
            { key: "workspaces", label: "Workspaces" },
            { key: "users", label: "Users" },
            { key: "webhookLogs", label: "Webhook Logs" },
            { key: "usageEvents", label: "Usage Events" },
            { key: "auditLogs", label: "Audit Logs" },
          ] as Array<{ key: TabKey; label: string }>),
    [superAdmin]
  );
  const [tab, setTab] = useState<TabKey>("workspaces");

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 border-b border-base-300 overflow-x-auto">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            role="tab"
            className={`relative px-3 py-2 font-mono-op text-[11px] tracking-[0.08em] uppercase transition-colors whitespace-nowrap ${
              tab === entry.key
                ? "text-primary after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-primary"
                : "text-base-content/55 hover:text-base-content"
            }`}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "workspaces" && <WorkspacesTab />}
      {tab === "users" && <UsersTab superAdmin={superAdmin} />}
      {tab === "webhookLogs" && <WebhookLogsTab />}
      {tab === "usageEvents" && <UsageEventsTab />}
      {tab === "auditLogs" && <AuditLogsTab />}
      {tab === "channelAccounts" && superAdmin && <ChannelAccountsTab />}
      {tab === "connectedClientBusinesses" && superAdmin && (
        <ConnectedClientBusinessesTab />
      )}
    </div>
  );
}

function WorkspacesTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PlatformWorkspaceStatus | "">("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [suspendWorkspaceId, setSuspendWorkspaceId] = useState<string | null>(null);

  const list = usePlatformWorkspaces({
    search: search.trim() || undefined,
    status: status || undefined,
    limit,
    offset,
  });
  const detail = usePlatformWorkspace(selectedWorkspaceId);
  const channelAccounts = useChannelAccounts();
  const suspend = useSuspendWorkspace();
  const reactivate = useReactivateWorkspace();

  const numbersByWorkspaceId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of channelAccounts.data ?? []) {
      const wid = (a.workspaceId ?? "").trim();
      if (!wid) continue;
      const label =
        (a.externalId ?? "").trim() ||
        (a.displayName ?? "").trim() ||
        a.id;
      const next = map.get(wid) ?? [];
      next.push(label);
      map.set(wid, next);
    }
    return map;
  }, [channelAccounts.data]);

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300">
        <div className="gap-3 p-4 sm:p-5">
          <h2 className="text-base font-semibold">Workspace Filters</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="input input-bordered"
              placeholder="Search by name/slug/email"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
            <select
              className="select select-bordered"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as PlatformWorkspaceStatus | "");
                setOffset(0);
              }}
            >
              <option value="">All statuses</option>
              {WORKSPACE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="select select-bordered"
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {list.error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[13px] text-base-content">{getApiError(list.error)}</p></div>
      )}
      {mutationError && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[13px] text-base-content">{mutationError}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-base-300 bg-base-100">
              <th className="op-label px-3 py-2.5 text-left font-medium">Name</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Plan</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Expiry</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Numbers</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Status</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Suspended</th>
              <th className="op-label px-3 py-2.5 text-right font-medium">Members</th>
              <th className="op-label px-3 py-2.5 text-right font-medium">Messages</th>
              <th className="op-label px-3 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((workspace) => (
              <tr key={workspace.id} className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0">
                <td className="px-3 py-3">
                  <div className="font-medium">{workspace.name}</div>
                  <div className="font-mono-op text-[10px] tracking-[0.04em] text-base-content/50">{workspace.slug}</div>
                </td>
                <td className="px-3 py-3 text-base-content/80">{workspace.plan || "—"}</td>
                <td className="font-mono-op px-3 py-3 text-[11px] tabular-nums text-base-content/70">{formatDate(workspace.planExpiresAt ?? null)}</td>
                <td className="px-3 py-3">
                  <div className="font-mono-op text-[11px] text-base-content/70">
                    {(numbersByWorkspaceId.get(workspace.id) ?? []).slice(0, 2).join(", ") || "—"}
                    {(numbersByWorkspaceId.get(workspace.id) ?? []).length > 2 && (
                      <span className="ml-1">
                        +{(numbersByWorkspaceId.get(workspace.id) ?? []).length - 2} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className={`op-tag ${workspace.status === "ACTIVE" ? "op-tag-ok" : ""}`}>{workspace.status}</span>
                </td>
                <td className="px-3 py-3">
                  {workspace.isSuspended ? <span className="op-tag op-tag-warn">Yes</span> : <span className="op-tag">No</span>}
                </td>
                <td className="font-mono-op px-3 py-3 text-right tabular-nums">{workspace._count.workspaceMembers}</td>
                <td className="font-mono-op px-3 py-3 text-right tabular-nums">{workspace._count.messages.toLocaleString()}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setSelectedWorkspaceId(workspace.id)}
                    >
                      Inspect
                    </button>
                    {workspace.isSuspended ? (
                      <button
                        className="btn btn-xs"
                        disabled={reactivate.isPending}
                        onClick={() => {
                          setMutationError(null);
                          reactivate.mutate(workspace.id, {
                            onError: (error) => setMutationError(getApiError(error)),
                          });
                        }}
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        className="btn btn-xs border-warning/40 text-warning hover:bg-warning/10"
                        disabled={suspend.isPending}
                        onClick={() => setSuspendWorkspaceId(workspace.id)}
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.items.length && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-[13px] text-base-content/55">
                  No workspaces found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="join">
        <button
          className="btn join-item btn-sm"
          disabled={offset === 0}
          onClick={() => setOffset((v) => Math.max(0, v - limit))}
        >
          Previous
        </button>
        <button className="btn join-item btn-sm btn-ghost" disabled>
          Offset {offset}
        </button>
        <button
          className="btn join-item btn-sm"
          disabled={!list.data || offset + limit >= list.data.total}
          onClick={() => setOffset((v) => v + limit)}
        >
          Next
        </button>
      </div>

      {selectedWorkspaceId && (
        <div className="card bg-base-100 border border-base-300">
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Workspace Inspection</h3>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setSelectedWorkspaceId(null)}
              >
                Close
              </button>
            </div>
            {detail.isLoading && <span className="loading loading-spinner loading-sm" />}
            {detail.error && (
              <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[13px] text-base-content">{getApiError(detail.error)}</p></div>
            )}
            {detail.data && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Workspace:</span> {detail.data.name}
                </div>
                <div>
                  <span className="font-medium">Slug:</span> {detail.data.slug}
                </div>
                <div>
                  <span className="font-medium">Plan:</span> {String(detail.data.plan ?? "-")}
                </div>
                <div>
                  <span className="font-medium">Plan expires at:</span>{" "}
                  {formatDate(String(detail.data.planExpiresAt ?? ""))}
                </div>
                <div>
                  <span className="font-medium">Billing email:</span>{" "}
                  {String(detail.data.billingEmail ?? "-")}
                </div>
                <div>
                  <span className="font-medium">Subscription:</span>{" "}
                  {String(detail.data.subscriptionId ?? "-")}
                </div>
                <div>
                  <span className="font-medium">Trial ends at:</span>{" "}
                  {formatDate(String(detail.data.trialEndsAt ?? ""))}
                </div>
                <div>
                  <span className="font-medium">Numbers (accounts):</span>{" "}
                  {(detail.data.cloudApiAccounts ?? [])
                    .map((a) => a.displayPhoneNumber || a.phoneNumberId || a.id)
                    .filter(Boolean)
                    .join(", ") || "-"}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {detail.data.status}
                </div>
                <div>
                  <span className="font-medium">Suspended At:</span>{" "}
                  {formatDate(detail.data.suspendedAt)}
                </div>
                <div>
                  <span className="font-medium">Members:</span>{" "}
                  {detail.data.members?.length ?? 0}
                </div>
                <div>
                  <span className="font-medium">Cloud API token configured:</span>{" "}
                  {detail.data.cloudApiConfig?.hasAccessToken ? "Yes" : "No"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={suspendWorkspaceId !== null}
        title="Suspend workspace"
        description="The workspace will be suspended immediately."
        confirmLabel="Suspend"
        tone="warning"
        loading={suspend.isPending}
        promptLabel="Reason (optional)"
        promptPlaceholder="e.g. payment overdue"
        onConfirm={(reason) => {
          if (!suspendWorkspaceId) return;
          setMutationError(null);
          suspend.mutate(
            { id: suspendWorkspaceId, reason: reason?.trim() || undefined },
            {
              onError: (error) => setMutationError(getApiError(error)),
              onSettled: () => setSuspendWorkspaceId(null),
            }
          );
        }}
        onClose={() => setSuspendWorkspaceId(null)}
      />
    </div>
  );
}

function UsersTab({ superAdmin }: { superAdmin: boolean }) {
  const [search, setSearch] = useState("");
  const [platformRoleFilter, setPlatformRoleFilter] = useState<PlatformRole | "">("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [updateRole, setUpdateRole] = useState<PlatformRole>("SUPPORT");
  const [mutationError, setMutationError] = useState<string | null>(null);

  const list = usePlatformUsers({
    search: search.trim() || undefined,
    platformRole: platformRoleFilter || undefined,
    offset,
    limit,
  });
  const detail = usePlatformUser(selectedUserId);
  const loginHistory = usePlatformUserLoginHistory(selectedUserId);
  const updatePlatformRole = useUpdatePlatformRole();

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300">
        <div className="gap-3 p-4 sm:p-5">
          <h2 className="text-base font-semibold">User Filters</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="input input-bordered"
              placeholder="Search email, name, phone"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
            <select
              className="select select-bordered"
              value={platformRoleFilter}
              onChange={(e) => {
                setPlatformRoleFilter(e.target.value as PlatformRole | "");
                setOffset(0);
              }}
            >
              <option value="">All platform roles</option>
              {PLATFORM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              className="select select-bordered"
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {list.error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[13px] text-base-content">{getApiError(list.error)}</p></div>
      )}
      {mutationError && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[13px] text-base-content">{mutationError}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-base-300 bg-base-100">
              <th className="op-label px-3 py-2.5 text-left font-medium">Email</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Platform Role</th>
              <th className="op-label px-3 py-2.5 text-right font-medium">Memberships</th>
              <th className="op-label px-3 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((user) => (
              <tr key={user.id} className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0">
                <td className="px-3 py-3 font-medium">{user.email}</td>
                <td className="px-3 py-3">
                  <span className="op-tag">{user.platformRole}</span>
                </td>
                <td className="font-mono-op px-3 py-3 text-right tabular-nums">{user.memberships?.length ?? 0}</td>
                <td className="px-3 py-3 text-right">
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setUpdateRole(user.platformRole);
                    }}
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.items.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[13px] text-base-content/55">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="join">
        <button
          className="btn join-item btn-sm"
          disabled={offset === 0}
          onClick={() => setOffset((v) => Math.max(0, v - limit))}
        >
          Previous
        </button>
        <button className="btn join-item btn-sm btn-ghost" disabled>
          Offset {offset}
        </button>
        <button
          className="btn join-item btn-sm"
          disabled={!list.data || offset + limit >= list.data.total}
          onClick={() => setOffset((v) => v + limit)}
        >
          Next
        </button>
      </div>

      {selectedUserId && (
        <div className="card bg-base-100 border border-base-300">
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">User Inspection</h3>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setSelectedUserId(null)}
              >
                Close
              </button>
            </div>
            {detail.isLoading && <span className="loading loading-spinner loading-sm" />}
            {detail.error && (
              <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[13px] text-base-content">{getApiError(detail.error)}</p></div>
            )}
            {detail.data && (
              <div className="space-y-3">
                <div className="text-sm">
                  <div>
                    <span className="font-medium">Email:</span> {detail.data.email}
                  </div>
                  <div>
                    <span className="font-medium">Platform role:</span>{" "}
                    {detail.data.platformRole}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Memberships</div>
                  <ul className="list rounded-box border border-base-300 bg-base-100">
                    {detail.data.memberships?.map((membership) => (
                      <li className="list-row" key={`${membership.workspaceId}-${membership.role}`}>
                        <div className="text-sm">
                          {membership.workspace?.name ?? membership.workspaceId}
                        </div>
                        <span className="op-tag">{membership.role}</span>
                      </li>
                    ))}
                    {!detail.data.memberships?.length && (
                      <li className="list-row text-base-content/60">No memberships.</li>
                    )}
                  </ul>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Login history</div>
                  {loginHistory.isLoading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : loginHistory.error ? (
                    <div className="text-error text-xs">
                      {getApiError(loginHistory.error)}
                    </div>
                  ) : (
                    <ul className="list rounded-box border border-base-300 bg-base-100">
                      {loginHistory.data?.slice(0, 20).map((entry, idx) => (
                        <li
                          className="list-row text-xs"
                          key={String(entry.id ?? `${entry.createdAt ?? "unknown"}-${idx}`)}
                        >
                          <div>{formatDate(String(entry.createdAt ?? ""))}</div>
                          <div className="truncate">{String(entry.ipAddress ?? "-")}</div>
                          <div className="truncate">{String(entry.userAgent ?? "-")}</div>
                        </li>
                      ))}
                      {!loginHistory.data?.length && (
                        <li className="list-row text-base-content/60">
                          No login history.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                {superAdmin ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="select select-bordered select-sm"
                      value={updateRole}
                      onChange={(e) => setUpdateRole(e.target.value as PlatformRole)}
                    >
                      {PLATFORM_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={updatePlatformRole.isPending}
                      onClick={() => {
                        setMutationError(null);
                        updatePlatformRole.mutate(
                          { id: detail.data.id, role: updateRole },
                          {
                            onError: (error) => setMutationError(getApiError(error)),
                          }
                        );
                      }}
                    >
                      Update platform role
                    </button>
                  </div>
                ) : (
                  <div role="alert" className="rounded-box border border-info/30 border-l-2 border-l-info bg-base-200 px-4 py-3">
                    <span>Role updates require SUPERADMIN.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WebhookLogsTab() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [provider, setProvider] = useState("");
  const [processed, setProcessed] = useState<"" | "true" | "false">("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);

  const list = usePlatformWebhookLogs({
    workspaceId: workspaceId || undefined,
    provider: provider || undefined,
    processed: processed === "" ? undefined : processed === "true",
    offset,
    limit,
  });

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300">
        <div className="gap-3 p-4 sm:p-5">
          <h2 className="text-base font-semibold">Webhook Logs Filters</h2>
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              className="input input-bordered"
              placeholder="Workspace ID"
              value={workspaceId}
              onChange={(e) => {
                setWorkspaceId(e.target.value);
                setOffset(0);
              }}
            />
            <input
              className="input input-bordered"
              placeholder="Provider"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setOffset(0);
              }}
            />
            <select
              className="select select-bordered"
              value={processed}
              onChange={(e) => {
                setProcessed(e.target.value as "" | "true" | "false");
                setOffset(0);
              }}
            >
              <option value="">Processed: All</option>
              <option value="true">Processed</option>
              <option value="false">Not processed</option>
            </select>
            <select
              className="select select-bordered"
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {list.error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[13px] text-base-content">{getApiError(list.error)}</p></div>
      )}
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-base-300 bg-base-100">
              <th className="op-label px-3 py-2.5 text-left font-medium">ID</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Workspace</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Provider</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Event</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Processed</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => (
              <tr key={row.id} className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0">
                <td className="font-mono-op max-w-48 truncate px-3 py-3 text-[10px] tracking-wider text-base-content/60">{row.id.slice(0, 8).toUpperCase()}</td>
                <td className="font-mono-op px-3 py-3 text-[10px] tracking-wider text-base-content/70">{row.workspaceId.slice(0, 8).toUpperCase()}</td>
                <td className="px-3 py-3"><span className="op-tag">{row.provider}</span></td>
                <td className="px-3 py-3 font-medium">{row.eventType}</td>
                <td className="px-3 py-3">
                  {row.processed ? <span className="op-tag op-tag-ok">Yes</span> : <span className="op-tag op-tag-warn">No</span>}
                </td>
                <td className="font-mono-op px-3 py-3 text-[11px] tabular-nums text-base-content/70">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.items.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[13px] text-base-content/55">
                  No webhook logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager
        offset={offset}
        limit={limit}
        total={list.data?.total ?? 0}
        onPrev={() => setOffset((v) => Math.max(0, v - limit))}
        onNext={() => setOffset((v) => v + limit)}
      />
    </div>
  );
}

function UsageEventsTab() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [eventType, setEventType] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);

  const list = usePlatformUsageEvents({
    workspaceId: workspaceId || undefined,
    eventType: eventType || undefined,
    offset,
    limit,
  });

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300">
        <div className="gap-3 p-4 sm:p-5">
          <h2 className="text-base font-semibold">Usage Events Filters</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="input input-bordered"
              placeholder="Workspace ID"
              value={workspaceId}
              onChange={(e) => {
                setWorkspaceId(e.target.value);
                setOffset(0);
              }}
            />
            <input
              className="input input-bordered"
              placeholder="Event type"
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                setOffset(0);
              }}
            />
            <select
              className="select select-bordered"
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {list.error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[13px] text-base-content">{getApiError(list.error)}</p></div>
      )}
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-base-300 bg-base-100">
              <th className="op-label px-3 py-2.5 text-left font-medium">ID</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Workspace</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Event Type</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => (
              <tr key={row.id} className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0">
                <td className="font-mono-op max-w-48 truncate px-3 py-3 text-[10px] tracking-wider text-base-content/60">{row.id.slice(0, 8).toUpperCase()}</td>
                <td className="font-mono-op px-3 py-3 text-[10px] tracking-wider text-base-content/70">{row.workspaceId.slice(0, 8).toUpperCase()}</td>
                <td className="px-3 py-3 font-medium">{row.eventType}</td>
                <td className="font-mono-op px-3 py-3 text-[11px] tabular-nums text-base-content/70">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.items.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[13px] text-base-content/55">
                  No usage events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager
        offset={offset}
        limit={limit}
        total={list.data?.total ?? 0}
        onPrev={() => setOffset((v) => Math.max(0, v - limit))}
        onNext={() => setOffset((v) => v + limit)}
      />
    </div>
  );
}

function AuditLogsTab() {
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);

  const list = usePlatformAuditLogs({
    action: action.trim() || undefined,
    targetType: targetType.trim() || undefined,
    targetId: targetId.trim() || undefined,
    actorUserId: actorUserId.trim() || undefined,
    offset,
    limit,
  });

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300">
        <div className="gap-3 p-4 sm:p-5">
          <h2 className="text-base font-semibold">Audit Logs Filters</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="input input-bordered"
              placeholder="Action (e.g. USER_PLATFORM_ROLE_UPDATED)"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setOffset(0);
              }}
            />
            <input
              className="input input-bordered"
              placeholder="Target type (e.g. USER, WORKSPACE)"
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                setOffset(0);
              }}
            />
            <input
              className="input input-bordered"
              placeholder="Target ID"
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setOffset(0);
              }}
            />
            <input
              className="input input-bordered"
              placeholder="Actor user ID"
              value={actorUserId}
              onChange={(e) => {
                setActorUserId(e.target.value);
                setOffset(0);
              }}
            />
            <select
              className="select select-bordered"
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {list.error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[13px] text-base-content">{getApiError(list.error)}</p></div>
      )}

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr>
              <th className="op-label px-3 py-2.5 text-left font-medium">Created</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Action</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Target</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Actor</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Request</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => (
              <tr key={row.id} className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0">
                <td className="font-mono-op px-3 py-3 text-[11px] tabular-nums text-base-content/70">{formatDate(row.createdAt)}</td>
                <td className="max-w-48 truncate px-3 py-3 font-medium">{row.action}</td>
                <td className="font-mono-op max-w-64 truncate px-3 py-3 text-[11px] text-base-content/70">
                  {row.targetType}:{row.targetId}
                </td>
                <td className="font-mono-op max-w-48 truncate px-3 py-3 text-[10px] tracking-wider text-base-content/60">{row.actorUserId.slice(0, 8).toUpperCase()}</td>
                <td className="font-mono-op max-w-48 truncate px-3 py-3 text-[10px] tracking-wider text-base-content/60">{row.requestId || "—"}</td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.items.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[13px] text-base-content/55">
                  No audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager
        offset={offset}
        limit={limit}
        total={list.data?.total ?? 0}
        onPrev={() => setOffset((v) => Math.max(0, v - limit))}
        onNext={() => setOffset((v) => v + limit)}
      />
    </div>
  );
}

function ChannelAccountsTab() {
  const list = useChannelAccounts();
  const assign = useAssignChannelAccount();
  const [workspaceMap, setWorkspaceMap] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {list.error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[13px] text-base-content">{getApiError(list.error)}</p></div>
      )}
      {errorMessage && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[13px] text-base-content">{errorMessage}</p></div>
      )}
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-base-300 bg-base-100">
              <th className="op-label px-3 py-2.5 text-left font-medium">Account</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Provider</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Assigned Workspace</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Re-assign</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((account) => (
              <tr key={account.id} className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0">
                <td className="px-3 py-3">
                  <div className="font-medium">{account.displayName || account.id}</div>
                  <div className="font-mono-op text-[10px] tracking-[0.04em] text-base-content/50">
                    {account.externalId || "—"}
                  </div>
                </td>
                <td className="px-3 py-3"><span className="op-tag">{account.provider || account.channel || "—"}</span></td>
                <td className="px-3 py-3 text-base-content/80">{account.workspace?.name || account.workspaceId || "—"}</td>
                <td className="px-3 py-3">
                  <div className="join">
                    <input
                      className="input input-bordered input-sm join-item"
                      placeholder="workspaceId (blank to unassign)"
                      value={workspaceMap[account.id] ?? ""}
                      onChange={(e) =>
                        setWorkspaceMap((prev) => ({
                          ...prev,
                          [account.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      className="btn btn-sm join-item"
                      disabled={assign.isPending}
                      onClick={() => {
                        setErrorMessage(null);
                        const workspaceId = (workspaceMap[account.id] ?? "").trim();
                        assign.mutate(
                          {
                            id: account.id,
                            workspaceId: workspaceId ? workspaceId : null,
                          },
                          { onError: (error) => setErrorMessage(getApiError(error)) }
                        );
                      }}
                    >
                      Save
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[13px] text-base-content/55">
                  No channel accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConnectedClientBusinessesTab() {
  const list = useConnectedClientBusinesses();

  return (
    <div className="space-y-4">
      {list.error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"><span className="op-label mb-1 block text-error">error</span><p className="text-[13px] text-base-content">{getApiError(list.error)}</p></div>
      )}
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-base-300 bg-base-100">
              <th className="op-label px-3 py-2.5 text-left font-medium">ID</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Name</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Verification</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Business status</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((business) => (
              <tr key={business.id} className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0">
                <td className="font-mono-op max-w-48 truncate px-3 py-3 text-[10px] tracking-wider text-base-content/60">{business.id.slice(0, 8).toUpperCase()}</td>
                <td className="px-3 py-3 font-medium">{business.name}</td>
                <td className="px-3 py-3"><span className="op-tag">{business.verification_status || "—"}</span></td>
                <td className="px-3 py-3"><span className="op-tag">{business.business_status || "—"}</span></td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[13px] text-base-content/55">
                  No connected client businesses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pager({
  offset,
  limit,
  total,
  onPrev,
  onNext,
}: {
  offset: number;
  limit: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="join">
      <button className="btn join-item btn-sm" disabled={offset === 0} onClick={onPrev}>
        Previous
      </button>
      <button className="btn join-item btn-sm btn-ghost" disabled>
        Offset {offset}
      </button>
      <button
        className="btn join-item btn-sm"
        disabled={offset + limit >= total}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}
