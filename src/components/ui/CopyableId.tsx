"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

/**
 * Compact mono ID with a click-to-copy affordance. On copy the button
 * confirms with a timestamp ("Copied 14:23:04") and reverts after 4s.
 *
 * Same Operator language used on the API-key + webhook secret reveals —
 * timestamping the action is appropriate for any flow where the user
 * needs to know exactly when the copy happened (paste into integration
 * code, security audit, etc.).
 *
 * `label` renders to the left of the id as an `op-label` micro-caption.
 * Use it to name what the id is for (e.g. "TEMPLATE ID",
 * "CHANNEL TEMPLATE VERSION ID"). Pass `srLabel` separately when the
 * visible label differs from what a screen reader should announce.
 */
export function CopyableId({
  value,
  label,
  srLabel,
  className = "",
}: {
  value: string;
  label?: string;
  srLabel?: string;
  className?: string;
}) {
  const [stamp, setStamp] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setStamp(`${hh}:${mm}:${ss}`);
      setTimeout(() => setStamp(null), 4000);
    } catch {
      // Clipboard unavailable (insecure context, very old browser, etc.).
      // The value is already selectable — let the user copy manually.
    }
  };

  return (
    <div
      className={`inline-flex max-w-full items-center gap-2 ${className}`.trim()}
    >
      {label ? (
        <span className="op-label shrink-0" aria-hidden="true">
          {label}
        </span>
      ) : null}
      <code
        className="select-all truncate font-mono-op text-[0.75rem] tabular-nums text-base-content/85"
        aria-label={srLabel ?? label ?? "Identifier"}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="btn btn-ghost btn-xs shrink-0 gap-1 font-mono-op text-[0.6875rem] tracking-[0.04em]"
        aria-label={`Copy ${srLabel ?? label ?? "id"}`}
      >
        {stamp ? (
          <span style={{ color: "var(--op-accent)" }}>Copied {stamp}</span>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}
