"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronLeft } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  webhooksApi,
  WEBHOOK_WILDCARD,
  type CreatedWebhookEndpointResponseDto,
  type WebhookEndpointResponseDto,
} from "@/lib/api";
import { LastUsedDot } from "@/lib/relative-time";
import { CreateWebhookEndpointDialog } from "./CreateWebhookEndpointDialog";
import { EditWebhookEndpointDialog } from "./EditWebhookEndpointDialog";
import { RotateSecretDialog } from "./RotateSecretDialog";
import { WebhookDetailPanel } from "./WebhookDetailPanel";

function endpointTitle(e: WebhookEndpointResponseDto): string {
  return e.description?.trim() || e.url;
}

function HealthDot({
  endpoint,
  now,
}: {
  endpoint: WebhookEndpointResponseDto;
  now: number;
}) {
  // The "last activity" is the better-of (lastSuccessAt, lastFailureAt) — the
  // failure dot stays grey/dim through the freshness scale anyway.
  const last = endpoint.lastSuccessAt;
  return <LastUsedDot lastUsedAt={last} now={now} />;
}

function EndpointCard({
  endpoint,
  selected,
  now,
  onSelect,
}: {
  endpoint: WebhookEndpointResponseDto;
  selected: boolean;
  now: number;
  onSelect: () => void;
}) {
  const isWildcard = endpoint.eventTypes.includes(WEBHOOK_WILDCARD);
  // Pending verify takes precedence — gates everything else.
  const status:
    | "pending-verify"
    | "active"
    | "disabled"
    | "auto-disabled" = endpoint.verifiedAt === null
    ? "pending-verify"
    : endpoint.disabledAt
      ? "auto-disabled"
      : endpoint.enabled
        ? "active"
        : "disabled";
  const statusBar =
    status === "active"
      ? "var(--op-ok)"
      : status === "auto-disabled"
        ? "var(--op-danger)"
        : status === "pending-verify"
          ? "var(--op-warn)"
          : "var(--op-ink-dim)";
  const statusLabel =
    status === "pending-verify" ? "PENDING VERIFY" : status.toUpperCase();
  const statusCls =
    status === "active"
      ? "op-tag op-tag-ok"
      : status === "auto-disabled"
        ? "op-tag op-tag-danger"
        : status === "pending-verify"
          ? "op-tag op-tag-warn"
          : "op-tag";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group w-full rounded-box border bg-base-200 p-3.5 text-left transition-colors ${
        selected
          ? "border-base-300"
          : "border-base-300/70 hover:border-base-300 hover:bg-[var(--op-bg-hover)]"
      }`}
      style={{
        borderLeftWidth: selected ? "2px" : "1px",
        borderLeftColor: selected ? "var(--op-accent)" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-[0.875rem] font-medium">
          {endpointTitle(endpoint)}
        </span>
        <span
          className={statusCls}
          style={{
            borderLeftWidth: "2px",
            borderLeftColor: statusBar,
            paddingLeft: "6px",
          }}
        >
          {statusLabel}
        </span>
      </div>
      <p className="mt-1 truncate font-mono-op text-[0.6875rem] text-base-content/50">
        {endpoint.url}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono-op text-[0.6875rem] tabular-nums text-base-content/60">
        <HealthDot endpoint={endpoint} now={now} />
        <span>
          {isWildcard ? (
            <>
              <span style={{ color: "var(--op-accent)" }}>*</span>{" "}
              <span className="tracking-[0.04em]">ALL FUTURE</span>
            </>
          ) : (
            `${endpoint.eventTypes.length} events`
          )}
        </span>
        <span className="text-base-content/40">v{endpoint.apiVersion}</span>
      </div>
    </button>
  );
}

export function WebhooksClient({
  initialEndpoints,
  workspaceDefaultApiVersion,
}: {
  initialEndpoints: WebhookEndpointResponseDto[];
  /** Workspace-level apiVersion default. Used to flag per-endpoint overrides
   *  in the detail panel. Optional — when undefined, no override badge shows. */
  workspaceDefaultApiVersion?: string;
}) {
  const router = useRouter();
  const [endpoints, setEndpoints] =
    useState<WebhookEndpointResponseDto[]>(initialEndpoints);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEndpoints[0]?.id ?? null,
  );
  const [now, setNow] = useState<number>(() => Date.now());
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] =
    useState<WebhookEndpointResponseDto | null>(null);
  const [rotateTarget, setRotateTarget] =
    useState<WebhookEndpointResponseDto | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<WebhookEndpointResponseDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Re-sync from server when props change (router.refresh after mutation).
  useEffect(() => {
    setEndpoints(initialEndpoints);
    // If the selected endpoint vanished (e.g. delete), clear selection.
    setSelectedId((prev) =>
      prev && initialEndpoints.some((e) => e.id === prev)
        ? prev
        : (initialEndpoints[0]?.id ?? null),
    );
  }, [initialEndpoints]);

  // Wall-clock tick for relative timestamps (30s is enough for cards).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const selected = useMemo(
    () => endpoints.find((e) => e.id === selectedId) ?? null,
    [endpoints, selectedId],
  );

  // ── Mutation callbacks ────────────────────────────────────────────
  const handleCreated = (created: CreatedWebhookEndpointResponseDto) => {
    // Drop the plaintextSecret from the persisted shape — it's not in the
    // list-row DTO and we don't want it sitting in client state.
    const { plaintextSecret: _unused, ...persisted } = created;
    void _unused;
    setEndpoints((prev) => [persisted, ...prev]);
    setSelectedId(persisted.id);
    router.refresh();
  };

  const handleSaved = (updated: WebhookEndpointResponseDto) => {
    setEndpoints((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e)),
    );
    router.refresh();
  };

  const handleRotated = (rotated: CreatedWebhookEndpointResponseDto) => {
    const { plaintextSecret: _unused, ...persisted } = rotated;
    void _unused;
    setEndpoints((prev) =>
      prev.map((e) => (e.id === persisted.id ? persisted : e)),
    );
    router.refresh();
  };

  const handleConfirmDelete = async (typedValue?: string) => {
    if (!deleteTarget) return;
    const expected = endpointTitle(deleteTarget);
    if ((typedValue ?? "").trim() !== expected) {
      setDeleteError(
        `Type "${expected}" exactly to confirm deletion.`,
      );
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await webhooksApi.delete(deleteTarget.id);
      setEndpoints((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) {
        const remaining = endpoints.filter((e) => e.id !== deleteTarget.id);
        setSelectedId(remaining[0]?.id ?? null);
      }
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setDeleteError(
        err.response?.data?.message ||
          (e instanceof Error ? e.message : "Failed to delete endpoint."),
      );
    } finally {
      setDeleting(false);
    }
  };

  // ── Empty state (zero endpoints) ──────────────────────────────────
  if (endpoints.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <h2
          className="italic text-[1.5rem] leading-tight text-base-content/90"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          No webhooks configured.
        </h2>
        <p className="mt-3 max-w-md text-[0.8125rem] leading-relaxed text-base-content/55">
          Subscribe to message and template events to push real-time updates
          into your app. MsgBuddy signs every delivery with HMAC-SHA256 over
          the raw body.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm mt-6"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add your first endpoint
        </button>
        <p className="mt-8 font-mono-op text-[0.6875rem] tracking-[0.16em] uppercase text-base-content/30">
          https://your-app.example.com/…  ●●●●●●●●  ????
        </p>

        <CreateWebhookEndpointDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      </div>
    );
  }

  // ── Master-detail ────────────────────────────────────────────────
  // Mobile: when an endpoint is selected, replace the list with the detail.
  // Desktop (lg+): both visible side by side.
  return (
    <div className="flex min-h-0 flex-1 gap-4">
      {/* Left column — endpoint list */}
      <aside
        className={`${
          selected ? "hidden lg:flex" : "flex"
        } w-full max-w-md flex-col gap-3 lg:w-[36%]`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-base-300 pb-3">
          <div className="flex items-center gap-3">
            <span className="op-section-title">endpoints</span>
            <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/40">
              {endpoints.length}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {endpoints.map((e) => (
            <EndpointCard
              key={e.id}
              endpoint={e}
              selected={e.id === selectedId}
              now={now}
              onSelect={() => setSelectedId(e.id)}
            />
          ))}
        </div>

        <p className="font-mono-op text-[0.6875rem] tracking-[0.08em] text-base-content/35">
          Signing: HMAC-SHA256 over raw body · X-MsgBuddy-Signature
        </p>
      </aside>

      {/* Right column — detail panel */}
      <section
        className={`${
          selected ? "flex" : "hidden lg:flex"
        } min-w-0 flex-1 flex-col`}
      >
        {selected ? (
          <>
            {/* Mobile back affordance */}
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="mb-3 inline-flex items-center gap-1.5 self-start font-mono-op text-[0.6875rem] tracking-[0.12em] uppercase text-base-content/55 hover:text-base-content lg:hidden"
            >
              <ChevronLeft className="h-3 w-3" />
              endpoints
            </button>
            <WebhookDetailPanel
              endpoint={selected}
              workspaceDefaultApiVersion={workspaceDefaultApiVersion}
              onEdit={() => setEditTarget(selected)}
              onRotate={() => setRotateTarget(selected)}
              onDelete={() => {
                setDeleteError(null);
                setDeleteTarget(selected);
              }}
              onUpdated={handleSaved}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <span className="op-label">select an endpoint</span>
          </div>
        )}
      </section>

      {/* Dialogs */}
      <CreateWebhookEndpointDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
      <EditWebhookEndpointDialog
        open={editTarget !== null}
        endpoint={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleSaved}
      />
      <RotateSecretDialog
        open={rotateTarget !== null}
        endpoint={rotateTarget}
        onClose={() => setRotateTarget(null)}
        onRotated={handleRotated}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this endpoint?"
        description={
          deleteTarget ? (
            <>
              <span className="block">
                Cascades to all{" "}
                <span className="font-mono-op text-base-content">
                  webhook_deliveries
                </span>{" "}
                history for this endpoint. This cannot be undone.
              </span>
              <span className="mt-2 block break-all font-mono-op text-[0.75rem] text-base-content/60">
                {deleteTarget.url}
              </span>
              {deleteError ? (
                <span
                  className="mt-2 block font-mono-op text-[0.6875rem] text-error"
                  role="alert"
                >
                  {deleteError}
                </span>
              ) : null}
            </>
          ) : null
        }
        promptLabel={`Type "${deleteTarget ? endpointTitle(deleteTarget) : ""}" to confirm`}
        promptPlaceholder={
          deleteTarget ? endpointTitle(deleteTarget) : ""
        }
        confirmLabel="Delete endpoint"
        tone="danger"
        loading={deleting}
        onConfirm={(typed) => void handleConfirmDelete(typed)}
        onClose={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
