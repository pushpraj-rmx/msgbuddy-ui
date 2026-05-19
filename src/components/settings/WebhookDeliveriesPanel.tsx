"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, RotateCw } from "lucide-react";
import {
  webhooksApi,
  type WebhookDeliveryResponseDto,
  type WebhookDeliveryStatus,
} from "@/lib/api";
import {
  absoluteUTC,
  relativeShort,
} from "@/lib/relative-time";
import { useRightPanel } from "@/components/right-panel/useRightPanel";

const TERMINAL: ReadonlySet<WebhookDeliveryStatus> = new Set([
  "SUCCESS",
  "FAILED",
]);

/** Adaptive poll cadence keyed on age since the row was enqueued. */
function pollIntervalMs(ageMs: number): number | null {
  if (ageMs < 10_000) return 1_000; // first 10s — tight
  if (ageMs < 40_000) return 3_000; // next 30s — easing
  return null; // give up; user must refresh
}

const STATUS_TONE: Record<
  WebhookDeliveryStatus,
  { cls: string; bar: string }
> = {
  PENDING: { cls: "op-tag", bar: "var(--op-ink-dim)" },
  IN_FLIGHT: { cls: "op-tag", bar: "var(--op-info)" },
  SUCCESS: { cls: "op-tag-ok", bar: "var(--op-ok)" },
  FAILED: { cls: "op-tag-danger", bar: "var(--op-danger)" },
};

function DeliveryStatusPill({
  status,
}: {
  status: WebhookDeliveryStatus;
}) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={tone.cls}
      style={{
        borderLeftWidth: "2px",
        borderLeftColor: tone.bar,
        paddingLeft: "8px",
      }}
    >
      {status === "IN_FLIGHT" ? (
        <>
          <span
            aria-hidden="true"
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--op-info)",
              marginRight: 6,
              display: "inline-block",
              animation: "op-pulse 1.4s infinite",
            }}
          />
          IN-FLIGHT
        </>
      ) : (
        status
      )}
    </span>
  );
}

function ResponseStatusGlyph({ status }: { status: number | null }) {
  if (status === null) {
    return (
      <span className="font-mono-op text-base-content/30">—</span>
    );
  }
  const colour =
    status >= 200 && status < 300
      ? "var(--op-ok)"
      : status >= 400 && status < 500
        ? "var(--op-warn)"
        : status >= 500
          ? "var(--op-danger)"
          : "var(--op-ink-muted)";
  return (
    <span
      className="font-mono-op tabular-nums text-[0.75rem]"
      style={{ color: colour }}
    >
      {status}
    </span>
  );
}

/** ─── Right-panel tab content ─────────────────────────────────────── */

function PayloadTab({
  delivery,
}: {
  delivery: WebhookDeliveryResponseDto;
}) {
  const [copied, setCopied] = useState(false);
  const json = useMemo(
    () => JSON.stringify(delivery.payload, null, 2),
    [delivery.payload],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(delivery.payload));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.75rem]">
        <div>
          <span className="op-label mb-0.5 block">event</span>
          <p className="font-mono-op">{delivery.eventType}</p>
        </div>
        <div>
          <span className="op-label mb-0.5 block">api-version</span>
          <p className="font-mono-op">{delivery.apiVersion}</p>
        </div>
        <div className="col-span-2">
          <span className="op-label mb-0.5 block">event id (dedup key)</span>
          <p className="break-all font-mono-op text-base-content/70">
            {delivery.eventId}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-base-300 pt-3">
        <span className="op-label">payload</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="btn btn-ghost btn-xs gap-1.5 font-mono-op text-[0.6875rem] tracking-[0.04em]"
        >
          {copied ? (
            <span style={{ color: "var(--op-accent)" }}>copied</span>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              copy json
            </>
          )}
        </button>
      </div>
      <pre
        className="min-h-0 flex-1 overflow-auto rounded-box border border-base-300 bg-[var(--op-bg-2)] p-3 font-mono-op text-[0.78125rem] leading-[1.55] text-base-content/90"
        style={{ tabSize: 2 }}
      >
        {json}
      </pre>
      <p className="font-mono-op text-[0.6875rem] text-base-content/40">
        signed via{" "}
        <span className="text-base-content/65">X-MsgBuddy-Signature</span>{" "}
        — see docs/WEBHOOK_VERIFICATION.md
      </p>
    </div>
  );
}

function ResponseTab({
  delivery,
}: {
  delivery: WebhookDeliveryResponseDto;
}) {
  if (delivery.attemptCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <span className="op-label">no response yet</span>
        <p className="max-w-xs text-[0.8125rem] text-base-content/55">
          This delivery has not been attempted. Once MsgBuddy fires it, the
          response and any retry details will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <span className="op-label mb-0.5 block">http status</span>
          <ResponseStatusGlyph status={delivery.responseStatus} />
        </div>
        <div>
          <span className="op-label mb-0.5 block">attempts</span>
          <span className="font-mono-op tabular-nums text-[0.75rem]">
            {delivery.attemptCount}
          </span>
        </div>
      </div>

      {delivery.error ? (
        <div className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2.5">
          <span className="op-label mb-1 block text-error">
            network / transport error
          </span>
          <p className="break-words font-mono-op text-[0.75rem]">
            {delivery.error}
          </p>
        </div>
      ) : null}

      {delivery.responseBody ? (
        <div className="flex min-h-0 flex-col gap-2">
          <span className="op-label">body (≤ 4 KB)</span>
          <pre className="max-h-80 overflow-auto rounded-box border border-base-300 bg-[var(--op-bg-2)] p-3 font-mono-op text-[0.75rem] leading-[1.55] text-base-content/90">
            {delivery.responseBody}
          </pre>
        </div>
      ) : !delivery.error ? (
        <p className="font-mono-op text-[0.6875rem] text-base-content/40">
          empty response body
        </p>
      ) : null}
    </div>
  );
}

function AttemptsTab({
  delivery,
  now,
}: {
  delivery: WebhookDeliveryResponseDto;
  now: number;
}) {
  const rows: Array<{ label: string; iso: string | null }> = [
    { label: "queued", iso: delivery.queuedAt },
    { label: "first attempt", iso: delivery.firstAttemptAt },
    { label: "last attempt", iso: delivery.lastAttemptAt },
    { label: "next attempt", iso: delivery.nextAttemptAt },
    { label: "completed", iso: delivery.completedAt },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <span className="op-label mb-0.5 block">status</span>
          <DeliveryStatusPill status={delivery.status} />
        </div>
        <div>
          <span className="op-label mb-0.5 block">attempts</span>
          <span className="font-mono-op tabular-nums text-[0.75rem]">
            {delivery.attemptCount}
          </span>
        </div>
      </div>

      <div className="rounded-box border border-base-300 bg-base-200">
        {rows.map((r, idx) => (
          <div
            key={r.label}
            className={`grid grid-cols-[7rem_1fr] items-baseline gap-3 px-3 py-2 ${
              idx !== rows.length - 1
                ? "border-b border-base-300"
                : ""
            }`}
          >
            <span className="op-label">{r.label}</span>
            <span
              className="font-mono-op text-[0.75rem] tabular-nums"
              title={absoluteUTC(r.iso) ?? undefined}
            >
              {r.iso ? (
                <>
                  <span className="text-base-content/85">
                    {relativeShort(r.iso, now) ?? r.iso}
                  </span>
                  <span className="ml-2 text-base-content/35">
                    {absoluteUTC(r.iso) ?? ""}
                  </span>
                </>
              ) : (
                <span className="text-base-content/30">—</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {delivery.attemptCount > 1 ? (
        <p className="font-mono-op text-[0.6875rem] text-base-content/40">
          {delivery.attemptCount - 1} retry
          {delivery.attemptCount - 1 === 1 ? "" : "ies"} between first and
          last attempt — exponential backoff up to 24h.
        </p>
      ) : null}
    </div>
  );
}

/** ─── The panel itself ────────────────────────────────────────────── */

export function WebhookDeliveriesPanel({
  endpointId,
  endpointEnabled,
  reloadToken = 0,
}: {
  endpointId: string;
  endpointEnabled: boolean;
  /** Bump this from the parent to force a refetch (e.g. after test-fire). */
  reloadToken?: number;
}) {
  const [items, setItems] = useState<WebhookDeliveryResponseDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [testing, setTesting] = useState(false);
  const [openedId, setOpenedId] = useState<string | null>(null);

  const { setContent, clearContent, panel } = useRightPanel();

  /** Per-delivery "next poll at" — only present for non-terminal rows. */
  const nextPollAt = useRef<Map<string, number>>(new Map());
  /** Per-delivery first-seen-at, used to compute age for cadence backoff. */
  const seenAt = useRef<Map<string, number>>(new Map());

  // Reset state when endpoint changes
  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    setError(null);
    nextPollAt.current = new Map();
    seenAt.current = new Map();
  }, [endpointId]);

  const fetchPage = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const result = await webhooksApi.listDeliveries(endpointId, {
          limit: 20,
          ...(cursor ? { cursor } : {}),
        });
        setItems((prev) =>
          replace ? result.items : [...prev, ...result.items],
        );
        setNextCursor(result.nextCursor);
        setError(null);
      } catch (e) {
        const err = e as { response?: { data?: { message?: string } } };
        setError(
          err.response?.data?.message ||
            (e instanceof Error ? e.message : "Failed to load deliveries."),
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [endpointId],
  );

  // Initial / reload fetch
  useEffect(() => {
    void fetchPage(null, true);
  }, [fetchPage, reloadToken]);

  // Bookkeeping for poll state — seed seenAt for any new non-terminal rows.
  useEffect(() => {
    const tNow = Date.now();
    for (const d of items) {
      if (!seenAt.current.has(d.id)) seenAt.current.set(d.id, tNow);
      if (TERMINAL.has(d.status)) {
        nextPollAt.current.delete(d.id);
      } else if (!nextPollAt.current.has(d.id)) {
        const age = tNow - (seenAt.current.get(d.id) ?? tNow);
        const ms = pollIntervalMs(age);
        if (ms !== null) nextPollAt.current.set(d.id, tNow + ms);
      }
    }
  }, [items]);

  // Wall-clock tick for relative-time refresh + poll dispatch.
  useEffect(() => {
    const id = setInterval(() => {
      const tNow = Date.now();
      setNow(tNow);
      const toPoll: string[] = [];
      for (const [deliveryId, when] of nextPollAt.current.entries()) {
        if (tNow >= when) toPoll.push(deliveryId);
      }
      for (const deliveryId of toPoll) {
        const age = tNow - (seenAt.current.get(deliveryId) ?? tNow);
        const cadence = pollIntervalMs(age);
        if (cadence === null) {
          nextPollAt.current.delete(deliveryId);
          continue;
        }
        nextPollAt.current.set(deliveryId, tNow + cadence);
        void webhooksApi.getDelivery(deliveryId).then((updated) => {
          setItems((prev) =>
            prev.map((row) => (row.id === updated.id ? updated : row)),
          );
        }).catch(() => {
          /* swallow; retry next tick */
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Re-render the right panel when the opened delivery row updates.
  useEffect(() => {
    if (!openedId) return;
    const fresh = items.find((d) => d.id === openedId);
    if (!fresh) return;
    // Don't openAfter here — content refresh, not a new user selection.
    setContent({
      source: "webhooks-delivery",
      title: `DELIVERY · ${fresh.id.slice(0, 16)}…`,
      tabs: [
        {
          key: "payload",
          label: "Payload",
          content: <PayloadTab delivery={fresh} />,
        },
        {
          key: "response",
          label: "Response",
          content: <ResponseTab delivery={fresh} />,
        },
        {
          key: "attempts",
          label: "Attempts",
          content: <AttemptsTab delivery={fresh} now={now} />,
        },
      ],
      openAfter: false,
    });
  }, [items, openedId, now, setContent]);

  // Detect right-panel close from elsewhere → forget the opened id.
  useEffect(() => {
    if (panel?.source !== "webhooks-delivery") setOpenedId(null);
  }, [panel?.source]);

  // Cleanup our right-panel content when this panel unmounts (page nav, etc).
  useEffect(() => {
    return () => clearContent("webhooks-delivery");
  }, [clearContent]);

  const openDeliveryDetail = (delivery: WebhookDeliveryResponseDto) => {
    setOpenedId(delivery.id);
    setContent({
      source: "webhooks-delivery",
      title: `DELIVERY · ${delivery.id.slice(0, 16)}…`,
      tabs: [
        {
          key: "payload",
          label: "Payload",
          content: <PayloadTab delivery={delivery} />,
        },
        {
          key: "response",
          label: "Response",
          content: <ResponseTab delivery={delivery} />,
        },
        {
          key: "attempts",
          label: "Attempts",
          content: <AttemptsTab delivery={delivery} now={now} />,
        },
      ],
      openAfter: true,
    });
  };

  const handleTestFire = async () => {
    setTesting(true);
    setError(null);
    try {
      const created = await webhooksApi.testFire(endpointId);
      // Optimistically prepend; subsequent fetchPage refresh will harmonise.
      seenAt.current.set(created.id, Date.now());
      setItems((prev) => [created, ...prev]);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(
        err.response?.data?.message ||
          (e instanceof Error ? e.message : "Failed to send test event."),
      );
    } finally {
      setTesting(false);
    }
  };

  const handleReplay = async (deliveryId: string) => {
    try {
      const created = await webhooksApi.replayDelivery(deliveryId);
      seenAt.current.set(created.id, Date.now());
      setItems((prev) => [created, ...prev]);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(
        err.response?.data?.message ||
          (e instanceof Error ? e.message : "Failed to replay."),
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-sm" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-3 border-b border-base-300 pb-3">
        <div className="flex items-center gap-3">
          <span className="op-section-title">recent deliveries</span>
          <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/40">
            {items.length}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => void handleTestFire()}
          disabled={testing || !endpointEnabled}
          title={
            endpointEnabled
              ? "Send a canned test event to this endpoint"
              : "Re-enable the endpoint to send a test event"
          }
        >
          {testing ? (
            <span className="loading loading-spinner loading-xs" />
          ) : null}
          Test fire
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2.5"
        >
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem]">{error}</p>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <h3
            className="italic text-[1.25rem] text-base-content/85"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Quiet so far.
          </h3>
          <p className="max-w-sm text-[0.8125rem] text-base-content/55">
            Send a test event to verify the URL, secret, and signature
            verification on your side are wired correctly.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-box border border-base-300 bg-base-200">
          <table className="w-full text-[0.8125rem]">
            <thead className="sticky top-0 z-10 bg-base-200">
              <tr className="border-b border-base-300">
                <th className="op-label px-3 py-2.5 text-left">Status</th>
                <th className="op-label px-3 py-2.5 text-left">Event</th>
                <th className="op-label px-3 py-2.5 text-left">HTTP</th>
                <th className="op-label px-3 py-2.5 text-left">Attempt</th>
                <th className="op-label px-3 py-2.5 text-left">Queued</th>
                <th className="op-label px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const isOpen = openedId === d.id;
                return (
                  <tr
                    key={d.id}
                    onClick={() => openDeliveryDetail(d)}
                    className={`cursor-pointer border-b border-base-300 last:border-b-0 align-middle transition-colors ${
                      isOpen
                        ? "bg-[var(--op-bg-hover)]"
                        : "hover:bg-[var(--op-bg-hover)]"
                    }`}
                  >
                    <td className="px-3 py-3">
                      <DeliveryStatusPill status={d.status} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono-op text-[0.75rem] tabular-nums">
                        {d.eventType}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <ResponseStatusGlyph status={d.responseStatus} />
                    </td>
                    <td className="px-3 py-3 font-mono-op text-[0.75rem] tabular-nums text-base-content/70">
                      {d.attemptCount}
                    </td>
                    <td
                      className="px-3 py-3 font-mono-op text-[0.75rem] tabular-nums text-base-content/70"
                      title={absoluteUTC(d.queuedAt)}
                    >
                      {relativeShort(d.queuedAt, now) ?? "—"}
                    </td>
                    <td
                      className="px-3 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs gap-1 text-base-content/65 hover:text-base-content"
                        onClick={() => void handleReplay(d.id)}
                        title="Re-fire as a new delivery (new envelope id)"
                      >
                        <RotateCw className="h-3 w-3" />
                        Replay
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {nextCursor ? (
            <div className="flex justify-center border-t border-base-300 bg-base-200 py-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm font-mono-op text-[0.6875rem] tracking-[0.08em]"
                onClick={() => void fetchPage(nextCursor, false)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
                Load more
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
