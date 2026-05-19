"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, RotateCw, Trash2 } from "lucide-react";
import type { WebhookEndpointResponseDto } from "@/lib/api";
import { webhooksApi, WEBHOOK_WILDCARD } from "@/lib/api";
import { absoluteUTC, relativeShort } from "@/lib/relative-time";
import { WebhookDeliveriesPanel } from "./WebhookDeliveriesPanel";

function EndpointStatusBadge({
  endpoint,
}: {
  endpoint: WebhookEndpointResponseDto;
}) {
  if (endpoint.disabledAt) {
    return (
      <span
        className="op-tag op-tag-danger"
        style={{
          borderLeftWidth: "2px",
          borderLeftColor: "var(--op-danger)",
          paddingLeft: "8px",
        }}
      >
        AUTO-DISABLED
      </span>
    );
  }
  if (!endpoint.enabled) {
    return (
      <span
        className="op-tag"
        style={{
          borderLeftWidth: "2px",
          borderLeftColor: "var(--op-ink-dim)",
          paddingLeft: "8px",
        }}
      >
        DISABLED
      </span>
    );
  }
  return (
    <span
      className="op-tag op-tag-ok"
      style={{
        borderLeftWidth: "2px",
        borderLeftColor: "var(--op-ok)",
        paddingLeft: "8px",
      }}
    >
      ACTIVE
    </span>
  );
}

export function WebhookDetailPanel({
  endpoint,
  workspaceDefaultApiVersion,
  onEdit,
  onRotate,
  onDelete,
  onUpdated,
}: {
  endpoint: WebhookEndpointResponseDto;
  workspaceDefaultApiVersion?: string;
  onEdit: () => void;
  onRotate: () => void;
  onDelete: () => void;
  /** Parent updates its endpoint list when this panel mutates the endpoint. */
  onUpdated: (updated: WebhookEndpointResponseDto) => void;
}) {
  const [reenabling, setReenabling] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [reenableError, setReenableError] = useState<string | null>(null);

  const handleReenable = async () => {
    setReenabling(true);
    setReenableError(null);
    try {
      // PATCH enabled=true clears disabledAt and resets the failure counter
      // on the backend.
      const updated = await webhooksApi.update(endpoint.id, { enabled: true });
      onUpdated(updated);
      setReloadToken((t) => t + 1);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setReenableError(
        err.response?.data?.message ||
          (e instanceof Error ? e.message : "Could not re-enable the endpoint."),
      );
    } finally {
      setReenabling(false);
    }
  };

  const eventLabel = endpoint.eventTypes.includes(WEBHOOK_WILDCARD)
    ? "ALL FUTURE"
    : `${endpoint.eventTypes.length} events`;

  const apiVersionDiffers =
    workspaceDefaultApiVersion !== undefined &&
    endpoint.apiVersion !== workspaceDefaultApiVersion;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Header strip */}
      <header className="flex flex-col gap-3 border-b border-base-300 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="truncate text-[1rem] font-semibold tracking-[-0.015em]">
                {endpoint.description || "Webhook endpoint"}
              </h2>
              <EndpointStatusBadge endpoint={endpoint} />
            </div>
            <p className="mt-1 break-all font-mono-op text-[0.78125rem] text-base-content/55">
              {endpoint.url}
            </p>
          </div>

          {/* Actions dropdown */}
          <div className="dropdown dropdown-end shrink-0">
            <button
              type="button"
              tabIndex={0}
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Endpoint actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu menu-sm z-30 mt-2 w-56 rounded-box border border-base-300 bg-base-200 p-2 shadow-lg"
            >
              <li>
                <button type="button" onClick={onEdit} className="gap-3">
                  <Pencil className="h-4 w-4 opacity-70" />
                  Edit endpoint
                </button>
              </li>
              <li>
                <button type="button" onClick={onRotate} className="gap-3">
                  <RotateCw className="h-4 w-4 opacity-70" />
                  Rotate signing secret
                </button>
              </li>
              <div className="my-1 h-px bg-base-300" />
              <li>
                <button
                  type="button"
                  onClick={onDelete}
                  className="gap-3 text-error hover:text-error"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete endpoint
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Metadata row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <span className="op-label mb-0.5 block">events</span>
            <p className="font-mono-op text-[0.75rem] tabular-nums">
              {eventLabel}
            </p>
          </div>
          <div>
            <span className="op-label mb-0.5 block">api-version</span>
            <p className="font-mono-op text-[0.75rem] tabular-nums">
              {endpoint.apiVersion}
              {apiVersionDiffers ? (
                <span
                  className="ml-1.5 text-[0.625rem] tracking-[0.04em] text-base-content/45"
                  title={`Workspace default: ${workspaceDefaultApiVersion}`}
                >
                  override
                </span>
              ) : null}
            </p>
          </div>
          <div>
            <span className="op-label mb-0.5 block">last success</span>
            <p
              className="font-mono-op text-[0.75rem] tabular-nums text-base-content/80"
              title={absoluteUTC(endpoint.lastSuccessAt)}
            >
              {endpoint.lastSuccessAt
                ? relativeShort(endpoint.lastSuccessAt, Date.now())
                : <span className="text-base-content/30">—</span>}
            </p>
          </div>
          <div>
            <span className="op-label mb-0.5 block">last failure</span>
            <p
              className="font-mono-op text-[0.75rem] tabular-nums text-base-content/80"
              title={absoluteUTC(endpoint.lastFailureAt)}
            >
              {endpoint.lastFailureAt
                ? relativeShort(endpoint.lastFailureAt, Date.now())
                : <span className="text-base-content/30">—</span>}
            </p>
          </div>
        </div>
      </header>

      {/* Auto-disabled band */}
      {endpoint.disabledAt ? (
        <div className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <span
                className="op-label mb-0.5 block"
                style={{ color: "var(--op-danger)" }}
              >
                auto-disabled
              </span>
              <p className="text-[0.8125rem] leading-relaxed">
                Suspended after sustained delivery failures
                {endpoint.consecutiveFailures > 0
                  ? ` (${endpoint.consecutiveFailures} consecutive)`
                  : ""}
                . Past deliveries are kept; new events will be skipped
                until you re-enable.
              </p>
              {endpoint.disabledReason ? (
                <p className="mt-1 font-mono-op text-[0.6875rem] text-base-content/40">
                  reason · {endpoint.disabledReason}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm shrink-0"
              onClick={() => void handleReenable()}
              disabled={reenabling}
            >
              {reenabling ? (
                <span className="loading loading-spinner loading-xs" />
              ) : null}
              Re-enable
            </button>
          </div>
          {reenableError ? (
            <div className="border-t border-error/20 px-4 py-2">
              <p className="font-mono-op text-[0.6875rem] text-error">
                {reenableError}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Deliveries panel */}
      <WebhookDeliveriesPanel
        endpointId={endpoint.id}
        endpointEnabled={endpoint.enabled && !endpoint.disabledAt}
        reloadToken={reloadToken}
      />
    </div>
  );
}
