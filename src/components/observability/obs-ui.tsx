"use client";

import { useState, type ReactNode } from "react";

/** Locale timestamp; em-dash for null. */
export function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function fmtDuration(ms?: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function JsonBlock({
  value,
  className,
}: {
  value: unknown;
  className?: string;
}) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre
      className={`max-h-96 overflow-auto rounded-box bg-base-200 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all ${className ?? ""}`}
    >
      {text ?? "—"}
    </pre>
  );
}

export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

const STATUS_BADGE: Record<string, string> = {
  processed: "badge-success",
  ok: "badge-success",
  success: "badge-success",
  delivered: "badge-success",
  read: "badge-success",
  sent: "badge-info",
  failed: "badge-error",
  error: "badge-error",
  stuck: "badge-warning",
  pending: "badge-ghost",
  queued: "badge-ghost",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="badge badge-ghost badge-sm">—</span>;
  const cls = STATUS_BADGE[status.toLowerCase()] ?? "badge-ghost";
  return <span className={`badge ${cls} badge-sm`}>{status}</span>;
}

/** Compact mono cell for ids; truncates with a title for the full value. */
export function IdCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="opacity-40">—</span>;
  return (
    <span className="font-mono text-xs" title={value}>
      {value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value}
    </span>
  );
}

export function ObsHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle ? (
          <p className="text-sm opacity-60">{subtitle}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
