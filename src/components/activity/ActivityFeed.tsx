"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  auditLogApi,
  workspaceApi,
  type AuditLogRow,
} from "@/lib/api";
import { describeActivity, describeActor } from "@/lib/activitySummaries";

const TONE_DOT: Record<string, string> = {
  default: "bg-base-content/30",
  info: "bg-info",
  warning: "bg-warning",
  error: "bg-error",
};

const RESOURCE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All activity" },
  { value: "campaign", label: "Campaigns" },
  { value: "message", label: "Messages" },
  { value: "contact", label: "Contacts" },
  { value: "template", label: "Templates" },
  { value: "workspace", label: "Workspace & settings" },
  { value: "other", label: "Other" },
];

/**
 * Workspace activity feed — human-readable rendering of the audit log
 * (every write in the workspace + system events like auto-retry rounds).
 * Reused full-page (Settings → Activity) and compact (campaign detail).
 */
export function ActivityFeed({
  workspaceId,
  meUserId,
  resource,
  resourceId,
  pageSize = 30,
  compact = false,
  showFilters = false,
  reloadToken = 0,
}: {
  workspaceId?: string;
  meUserId?: string;
  /** Pin the feed to one resource type (e.g. "campaign"). */
  resource?: string;
  /** Pin the feed to one entity (pair with `resource`). */
  resourceId?: string;
  pageSize?: number;
  compact?: boolean;
  showFilters?: boolean;
  reloadToken?: number;
}) {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resourceFilter, setResourceFilter] = useState("");
  const [memberNames, setMemberNames] = useState<Map<string, string>>(
    new Map(),
  );

  const effectiveResource = resource ?? (resourceFilter || undefined);

  const fetchPage = useCallback(
    async (nextCursor?: string | null, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const data = await auditLogApi.list({
          ...(effectiveResource ? { resource: effectiveResource } : {}),
          ...(resourceId ? { resourceId } : {}),
          ...(nextCursor ? { cursor: nextCursor } : {}),
          limit: pageSize,
        });
        setRows((prev) => (append ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor);
      } catch {
        setError("Couldn't load activity.");
      } finally {
        setLoading(false);
      }
    },
    [effectiveResource, resourceId, pageSize],
  );

  useEffect(() => {
    void fetchPage(null, false);
  }, [fetchPage, reloadToken]);

  // Resolve member names once so rows read "Priya retried…" not a user id.
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const members = (await workspaceApi.getMembers(workspaceId)) as Array<{
          user?: { id?: string; name?: string | null; email?: string };
        }>;
        if (cancelled || !Array.isArray(members)) return;
        const map = new Map<string, string>();
        for (const m of members) {
          if (m.user?.id) map.set(m.user.id, m.user.name || m.user.email || "Team member");
        }
        setMemberNames(map);
      } catch {
        // names are a nicety — fall back to generic labels
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const items = useMemo(
    () =>
      rows.map((row) => ({
        row,
        summary: describeActivity(row),
        actor: describeActor(row, memberNames, meUserId ?? null),
      })),
    [rows, memberNames, meUserId],
  );

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {showFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select select-bordered select-sm"
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
          >
            {RESOURCE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1"
            onClick={() => void fetchPage(null, false)}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
          {error}{" "}
          <button type="button" className="link" onClick={() => void fetchPage(null, false)}>
            Try again
          </button>
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="skeleton h-24 rounded-box" />
      ) : rows.length === 0 && !error ? (
        <p className="text-sm text-base-content/60">
          No activity yet{effectiveResource ? " for this filter" : ""}.
        </p>
      ) : (
        <ul className={`${compact ? "max-h-72 overflow-auto" : ""} divide-y divide-base-300 rounded-box border border-base-300 bg-base-100`}>
          {items.map(({ row, summary, actor }) => (
            <li key={row.id} className={compact ? "px-3 py-2" : "px-4 py-3"}>
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[summary.tone]}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={compact ? "text-[0.8125rem]" : "text-sm"}>
                    {summary.title}
                  </p>
                  {summary.detail ? (
                    <p className="text-xs text-base-content/60">{summary.detail}</p>
                  ) : null}
                  <p className="mt-0.5 text-[0.6875rem] text-base-content/40">
                    {actor} · {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm w-full"
          onClick={() => void fetchPage(cursor, true)}
          disabled={loading}
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}
