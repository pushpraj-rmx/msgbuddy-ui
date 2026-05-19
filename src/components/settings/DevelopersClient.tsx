"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CreateApiKeyDialog } from "./CreateApiKeyDialog";
import {
  apiKeysApi,
  type ApiKeyResponseDto,
  type CreatedApiKeyResponseDto,
} from "@/lib/api";

type LifecycleStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

function lifecycleStatus(k: ApiKeyResponseDto, now: number): LifecycleStatus {
  if (k.revokedAt) return "REVOKED";
  if (k.expiresAt && new Date(k.expiresAt).getTime() <= now) return "EXPIRED";
  return "ACTIVE";
}

/** Compact "12s / 4m / 3h / 2d / 6w / 8mo / 2y" — null returns null. */
function relativeShort(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Math.max(0, now - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 4) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

function absoluteUTC(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return undefined;
  return t.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

/**
 * Three-weight masked-key glyph: dim prefix · mid-weight bullets · bright tail.
 * The tail is what lets a user identify a specific key from a list of similar ones,
 * so it gets the strongest visual weight.
 */
function MaskedKeyGlyph({
  prefix,
  lastFour,
}: {
  prefix: "mb_live" | "mb_test";
  lastFour: string;
}) {
  return (
    <span className="font-mono-op text-[0.78125rem] tabular-nums tracking-tight">
      <span className="text-base-content/40">{prefix}_</span>
      <span
        className="text-base-content/55"
        style={{ letterSpacing: "0.18em" }}
        aria-hidden="true"
      >
        ●●●●●●●●
      </span>
      <span className="text-base-content/95">{lastFour}</span>
    </span>
  );
}

/**
 * Status pill — 2px left bar in the status colour, otherwise a quiet mono
 * uppercase capsule. Same visual language as inline error boxes elsewhere.
 */
function StatusPill({ status }: { status: LifecycleStatus }) {
  const tone = {
    ACTIVE: { cls: "op-tag-ok", barVar: "var(--op-ok)" },
    REVOKED: { cls: "op-tag", barVar: "var(--op-ink-dim)" },
    EXPIRED: { cls: "op-tag-warn", barVar: "var(--op-warn)" },
  }[status];
  return (
    <span
      className={tone.cls}
      style={{
        borderLeftWidth: "2px",
        borderLeftColor: tone.barVar,
        paddingLeft: "8px",
      }}
    >
      {status}
    </span>
  );
}

/**
 * Last-used indicator. Six-pixel dot with a freshness gradient + relative
 * timestamp. Lets a user with three keys see which one is hot in production
 * right now without diving into the usage log.
 */
function LastUsedDot({
  lastUsedAt,
  now,
}: {
  lastUsedAt: string | null;
  now: number;
}) {
  if (!lastUsedAt) {
    return <span className="font-mono-op text-base-content/30">—</span>;
  }
  const then = new Date(lastUsedAt).getTime();
  const ageMs = now - then;
  const hour = 3600_000;
  const day = 24 * hour;
  let bg: string;
  let opacity = 1;
  if (ageMs < hour) {
    bg = "var(--op-accent)";
  } else if (ageMs < day) {
    bg = "var(--op-accent)";
    opacity = 0.5;
  } else {
    bg = "var(--op-ink-dim)";
    opacity = 0.65;
  }
  return (
    <span
      className="font-mono-op inline-flex items-center gap-2 text-[0.75rem] tabular-nums"
      title={absoluteUTC(lastUsedAt)}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: bg,
          opacity,
          flexShrink: 0,
        }}
      />
      <span className="text-base-content/80">{relativeShort(lastUsedAt, now)}</span>
    </span>
  );
}

export function DevelopersClient({
  initialKeys,
}: {
  initialKeys: ApiKeyResponseDto[];
}) {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyResponseDto[]>(initialKeys);
  const [now, setNow] = useState<number>(() => Date.now());
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyResponseDto | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Re-sync from server when props change (after router.refresh).
  useEffect(() => {
    setKeys(initialKeys);
  }, [initialKeys]);

  // Tick "now" every 30s so relative timestamps don't go stale on long sessions.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const sorted = useMemo(() => {
    return [...keys].sort((a, b) => {
      // Active first, then revoked / expired — within each group, newest first.
      const aActive = lifecycleStatus(a, now) === "ACTIVE" ? 0 : 1;
      const bActive = lifecycleStatus(b, now) === "ACTIVE" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [keys, now]);

  const handleCreated = (created: CreatedApiKeyResponseDto) => {
    const { plaintextKey: _unused, ...persisted } = created;
    void _unused;
    setKeys((prev) => [persisted, ...prev]);
    router.refresh();
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setError(null);
    try {
      await apiKeysApi.revoke(revokeTarget.id);
      const stampedAt = new Date().toISOString();
      setKeys((prev) =>
        prev.map((k) =>
          k.id === revokeTarget.id ? { ...k, revokedAt: stampedAt } : k,
        ),
      );
      setRevokeTarget(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke key.");
    } finally {
      setRevoking(false);
    }
  };

  const activeCount = sorted.filter(
    (k) => lifecycleStatus(k, now) === "ACTIVE",
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-3">
        <div className="flex items-center gap-3">
          <span className="op-section-title">api keys</span>
          <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/40">
            {activeCount} active{" "}
            {sorted.length > activeCount
              ? `· ${sorted.length - activeCount} revoked/expired`
              : ""}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setCreateOpen(true)}
        >
          + New API key
        </button>
      </div>

      {/* Error */}
      {error ? (
        <div
          role="alert"
          className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"
        >
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem]">{error}</p>
        </div>
      ) : null}

      {/* Empty state — the page's one editorial moment */}
      {sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
          <h2
            className="italic text-[1.5rem] leading-tight text-base-content/90"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            No keys yet.
          </h2>
          <p className="mt-3 max-w-md text-[0.8125rem] leading-relaxed text-base-content/55">
            Generate one to let external apps send messages and listen to
            webhook events on this workspace&apos;s behalf.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-6"
            onClick={() => setCreateOpen(true)}
          >
            Generate your first key
          </button>
          <p className="mt-8 font-mono-op text-[0.6875rem] tracking-[0.16em] uppercase text-base-content/30">
            mb_live_  ●●●●●●●●  ????
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="border-b border-base-300">
                <th className="op-label px-4 py-2.5 text-left">Label</th>
                <th className="op-label px-4 py-2.5 text-left">Key</th>
                <th className="op-label px-4 py-2.5 text-left">Status</th>
                <th className="op-label px-4 py-2.5 text-left">Last used</th>
                <th className="op-label px-4 py-2.5 text-left">Created</th>
                <th className="op-label px-4 py-2.5 text-left">Expires</th>
                <th className="op-label px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((k) => {
                const status = lifecycleStatus(k, now);
                return (
                  <tr
                    key={k.id}
                    className="border-b border-base-300 last:border-b-0 align-middle"
                    style={{ opacity: status === "ACTIVE" ? 1 : 0.55 }}
                  >
                    <td className="px-4 py-3 font-medium">{k.label}</td>
                    <td className="px-4 py-3">
                      <MaskedKeyGlyph prefix={k.prefix} lastFour={k.lastFour} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={status} />
                    </td>
                    <td className="px-4 py-3">
                      <LastUsedDot lastUsedAt={k.lastUsedAt} now={now} />
                    </td>
                    <td
                      className="px-4 py-3 font-mono-op text-[0.75rem] tabular-nums text-base-content/70"
                      title={absoluteUTC(k.createdAt)}
                    >
                      {relativeShort(k.createdAt, now) ?? "—"}
                    </td>
                    <td
                      className="px-4 py-3 font-mono-op text-[0.75rem] tabular-nums text-base-content/70"
                      title={absoluteUTC(k.expiresAt)}
                    >
                      {k.expiresAt
                        ? relativeShort(k.expiresAt, now)?.replace(" ago", "")
                        : <span className="text-base-content/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === "ACTIVE" ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error/70 hover:text-error"
                          onClick={() => setRevokeTarget(k)}
                          disabled={revoking}
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="font-mono-op text-[0.6875rem] text-base-content/30">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footnote — keeps the page honest about the unimplemented scope feature */}
      {sorted.length > 0 ? (
        <p className="font-mono-op text-[0.6875rem] tracking-[0.08em] text-base-content/35">
          Each key has full workspace access today. Per-key scope enforcement
          ships with sandbox mode.
        </p>
      ) : null}

      <CreateApiKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revoke this key?"
        description={
          revokeTarget ? (
            <>
              Any app using{" "}
              <span className="font-mono-op text-base-content">
                {revokeTarget.prefix}_…{revokeTarget.lastFour}
              </span>{" "}
              will start receiving 401 Unauthorized within seconds. This cannot
              be undone.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Revoke key"
        tone="danger"
        loading={revoking}
        onConfirm={() => void handleConfirmRevoke()}
        onClose={() => {
          if (!revoking) setRevokeTarget(null);
        }}
      />
    </div>
  );
}
