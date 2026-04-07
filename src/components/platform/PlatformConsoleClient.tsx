"use client";

import { useMemo, useState } from "react";
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

type TabKey =
  | "workspaces"
  | "users"
  | "webhookLogs"
  | "usageEvents"
  | "auditLogs"
  | "channelAccounts"
  | "connectedClientBusinesses";

function getApiError(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message
    ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message)
    : "Something went wrong.";
}

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
      <div role="tablist" className="tabs tabs-box">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            role="tab"
            className={`tab ${tab === entry.key ? "tab-active" : ""}`}
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
      <div className="rounded-box border border-base-300 bg-base-100">
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
        <div role="alert" className="alert alert-error">
          <span>{getApiError(list.error)}</span>
        </div>
      )}
      {mutationError && (
        <div role="alert" className="alert alert-error">
          <span>{mutationError}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Plan</th>
              <th>Expiry</th>
              <th>Numbers</th>
              <th>Status</th>
              <th>Suspended</th>
              <th>Members</th>
              <th>Messages</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((workspace) => (
              <tr key={workspace.id}>
                <td>
                  <div className="font-medium">{workspace.name}</div>
                  <div className="text-xs text-base-content/60">{workspace.slug}</div>
                </td>
                <td>{workspace.plan || "-"}</td>
                <td>{formatDate(workspace.planExpiresAt ?? null)}</td>
                <td>
                  <div className="text-xs text-base-content/70">
                    {(numbersByWorkspaceId.get(workspace.id) ?? []).slice(0, 2).join(", ") ||
                      "-"}
                    {(numbersByWorkspaceId.get(workspace.id) ?? []).length > 2 && (
                      <span className="ml-1">
                        +{(numbersByWorkspaceId.get(workspace.id) ?? []).length - 2} more
                      </span>
                    )}
                  </div>
                </td>
                <td>{workspace.status}</td>
                <td>{workspace.isSuspended ? "Yes" : "No"}</td>
                <td>{workspace._count.workspaceMembers}</td>
                <td>{workspace._count.messages}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setSelectedWorkspaceId(workspace.id)}
                    >
                      Inspect
                    </button>
                    {workspace.isSuspended ? (
                      <button
                        className="btn btn-success btn-soft btn-xs"
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
                        className="btn btn-warning btn-soft btn-xs"
                        disabled={suspend.isPending}
                        onClick={() => {
                          const reason = window.prompt("Suspend reason (optional)") ?? "";
                          setMutationError(null);
                          suspend.mutate(
                            { id: workspace.id, reason: reason.trim() || undefined },
                            { onError: (error) => setMutationError(getApiError(error)) }
                          );
                        }}
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
                <td colSpan={9} className="text-center text-base-content/60">
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
        <div className="rounded-box border border-base-300 bg-base-100">
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
              <div role="alert" className="alert alert-error">
                <span>{getApiError(detail.error)}</span>
              </div>
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
      <div className="rounded-box border border-base-300 bg-base-100">
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
        <div role="alert" className="alert alert-error">
          <span>{getApiError(list.error)}</span>
        </div>
      )}
      {mutationError && (
        <div role="alert" className="alert alert-error">
          <span>{mutationError}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Email</th>
              <th>Platform Role</th>
              <th>Memberships</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.platformRole}</td>
                <td>{user.memberships?.length ?? 0}</td>
                <td>
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
                <td colSpan={4} className="text-center text-base-content/60">
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
        <div className="rounded-box border border-base-300 bg-base-100">
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
              <div role="alert" className="alert alert-error">
                <span>{getApiError(detail.error)}</span>
              </div>
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
                        <div className="badge badge-ghost">{membership.role}</div>
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
                  <div role="alert" className="alert alert-info alert-soft">
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
      <div className="rounded-box border border-base-300 bg-base-100">
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
        <div role="alert" className="alert alert-error">
          <span>{getApiError(list.error)}</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>Workspace</th>
              <th>Provider</th>
              <th>Event</th>
              <th>Processed</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => (
              <tr key={row.id}>
                <td className="max-w-48 truncate">{row.id}</td>
                <td>{row.workspaceId}</td>
                <td>{row.provider}</td>
                <td>{row.eventType}</td>
                <td>{row.processed ? "Yes" : "No"}</td>
                <td>{formatDate(row.createdAt)}</td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.items.length && (
              <tr>
                <td colSpan={6} className="text-center text-base-content/60">
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
      <div className="rounded-box border border-base-300 bg-base-100">
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
        <div role="alert" className="alert alert-error">
          <span>{getApiError(list.error)}</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>Workspace</th>
              <th>Event Type</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => (
              <tr key={row.id}>
                <td className="max-w-48 truncate">{row.id}</td>
                <td>{row.workspaceId}</td>
                <td>{row.eventType}</td>
                <td>{formatDate(row.createdAt)}</td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.items.length && (
              <tr>
                <td colSpan={4} className="text-center text-base-content/60">
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
      <div className="rounded-box border border-base-300 bg-base-100">
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
        <div role="alert" className="alert alert-error">
          <span>{getApiError(list.error)}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Created</th>
              <th>Action</th>
              <th>Target</th>
              <th>Actor</th>
              <th>Request</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.createdAt)}</td>
                <td className="max-w-48 truncate">{row.action}</td>
                <td className="max-w-64 truncate">
                  {row.targetType}:{row.targetId}
                </td>
                <td className="max-w-48 truncate">{row.actorUserId}</td>
                <td className="max-w-48 truncate">{row.requestId || "-"}</td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.items.length && (
              <tr>
                <td colSpan={5} className="text-center text-base-content/60">
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
        <div role="alert" className="alert alert-error">
          <span>{getApiError(list.error)}</span>
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="alert alert-error">
          <span>{errorMessage}</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Account</th>
              <th>Provider</th>
              <th>Assigned Workspace</th>
              <th>Re-assign</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((account) => (
              <tr key={account.id}>
                <td>
                  <div className="font-medium">{account.displayName || account.id}</div>
                  <div className="text-xs text-base-content/60">
                    {account.externalId || "-"}
                  </div>
                </td>
                <td>{account.provider || account.channel || "-"}</td>
                <td>{account.workspace?.name || account.workspaceId || "-"}</td>
                <td>
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
                <td colSpan={4} className="text-center text-base-content/60">
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
        <div role="alert" className="alert alert-error">
          <span>{getApiError(list.error)}</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Verification</th>
              <th>Business status</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((business) => (
              <tr key={business.id}>
                <td className="max-w-48 truncate">{business.id}</td>
                <td>{business.name}</td>
                <td>{business.verification_status || "-"}</td>
                <td>{business.business_status || "-"}</td>
              </tr>
            ))}
            {!list.isLoading && !list.data?.length && (
              <tr>
                <td colSpan={4} className="text-center text-base-content/60">
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
