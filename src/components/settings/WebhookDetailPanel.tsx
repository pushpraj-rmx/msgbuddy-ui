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
  // Status precedence: PENDING VERIFY > AUTO-DISABLED > DISABLED > ACTIVE.
  // Verification gates everything, so an unverified row is always "PENDING"
  // regardless of the enabled / disabledAt fields.
  if (endpoint.verifiedAt === null) {
    return (
      <span
        className="op-tag op-tag-warn"
        style={{
          borderLeftWidth: "2px",
          borderLeftColor: "var(--op-warn)",
          paddingLeft: "8px",
        }}
      >
        PENDING VERIFY
      </span>
    );
  }
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

/** Friendly english for the most-common verification failure reasons. */
const VERIFY_REASON_HINT: Record<string, string> = {
  CHALLENGE_MISMATCH:
    'Your handler responded but did not echo the mb_challenge value. ' +
    'Make sure you read mb_challenge from the query string and write it back as ' +
    'the response body (text/plain, no JSON wrapping).',
  NON_2XX_RESPONSE:
    'Your handler responded with a non-200 status code.',
  TIMEOUT:
    'Your handler did not respond within 10 seconds.',
  DNS_FAILURE:
    'MsgBuddy could not resolve the URL. Check the hostname.',
  TLS_FAILURE:
    'The TLS handshake failed. Make sure the certificate is valid.',
  EMPTY_BODY:
    'Your handler responded 200 but with an empty body.',
  RESPONSE_TOO_LARGE:
    'Your handler responded with more than 4 KB of body. The handler should write only the mb_challenge value.',
  URL_REJECTED_SSRF:
    'URL resolves to a private / loopback / link-local IP and was rejected.',
};

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

  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<{
    reason?: string;
    detail?: string;
    httpStatus?: number;
  } | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const updated = await webhooksApi.verify(endpoint.id);
      onUpdated(updated);
      // Once verified, the deliveries panel will start showing data on
      // first test-fire — bump the reload token so the panel refreshes.
      setReloadToken((t) => t + 1);
    } catch (e) {
      const err = e as {
        response?: {
          data?: {
            message?: string;
            details?: {
              reason?: string;
              detail?: string;
              httpStatus?: number;
            };
          };
        };
      };
      const details = err.response?.data?.details;
      setVerifyError({
        reason: details?.reason,
        detail: details?.detail ?? err.response?.data?.message,
        httpStatus: details?.httpStatus,
      });
    } finally {
      setVerifying(false);
    }
  };

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

      {/* Pending-verify band — takes priority over auto-disabled because
          an unverified endpoint can't have fired any deliveries yet.
          Amber tone (not red) — verification is the user's next step, not
          a failure they need to recover from. */}
      {endpoint.verifiedAt === null ? (
        <div className="rounded-box border border-warning/40 border-l-2 border-l-warning bg-base-200">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <span
                className="op-label mb-0.5 block"
                style={{ color: "var(--op-warn)" }}
              >
                awaiting verification
              </span>
              <p className="text-[0.8125rem] leading-relaxed">
                MsgBuddy will issue a single{" "}
                <span className="font-mono-op text-base-content">
                  GET {endpoint.url}
                </span>{" "}
                with{" "}
                <span className="font-mono-op text-base-content">
                  mb_verify_token
                </span>{" "}
                +{" "}
                <span className="font-mono-op text-base-content">
                  mb_challenge
                </span>{" "}
                query params. Your handler must echo{" "}
                <span className="font-mono-op text-base-content">
                  mb_challenge
                </span>{" "}
                as the plain-text response body. No events deliver until
                this succeeds.
              </p>
              {endpoint.lastVerifyError ? (
                <div className="mt-2 rounded-box border border-error/20 bg-base-100 px-3 py-2">
                  <span className="op-label mb-1 block text-error">
                    last attempt failed
                  </span>
                  <p className="font-mono-op text-[0.6875rem] text-error/85">
                    {endpoint.lastVerifyError}
                  </p>
                  {VERIFY_REASON_HINT[endpoint.lastVerifyError] ? (
                    <p className="mt-1 text-[0.75rem] leading-relaxed text-base-content/70">
                      {VERIFY_REASON_HINT[endpoint.lastVerifyError]}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {verifyError ? (
                <div className="mt-2 rounded-box border border-error/30 border-l-2 border-l-error bg-base-100 px-3 py-2">
                  <span className="op-label mb-1 block text-error">
                    verification failed
                  </span>
                  <p className="font-mono-op text-[0.6875rem] text-error/85">
                    {verifyError.reason ?? "unknown"}
                    {verifyError.httpStatus
                      ? ` · http ${verifyError.httpStatus}`
                      : ""}
                  </p>
                  {verifyError.detail ? (
                    <p className="mt-1 text-[0.75rem] leading-relaxed text-base-content/70">
                      {verifyError.detail}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm shrink-0"
              onClick={() => void handleVerify()}
              disabled={verifying}
            >
              {verifying ? (
                <span className="loading loading-spinner loading-xs" />
              ) : null}
              {verifying ? "Verifying…" : "Verify endpoint"}
            </button>
          </div>
        </div>
      ) : null}

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
        // Test-fire requires the endpoint to be enabled, not auto-disabled,
        // AND verified — the backend returns 422 WEBHOOK_NOT_VERIFIED if
        // verifiedAt is null, so we lock the button up here for clarity.
        endpointEnabled={
          endpoint.enabled &&
          !endpoint.disabledAt &&
          endpoint.verifiedAt !== null
        }
        reloadToken={reloadToken}
      />
    </div>
  );
}
