"use client";

import { useMemo, useRef } from "react";
import {
  WEBHOOK_EVENT_CATALOGUE,
  WEBHOOK_WILDCARD,
} from "@/lib/api";

type Category = "MESSAGE" | "TEMPLATE" | "CONTACT" | "SYSTEM";

/**
 * Grouped event-type picker for webhook endpoints.
 *
 * Wildcard semantics: selecting `*` flips all explicit events off (because
 * they're redundant when subscribed to all). Unchecking `*` restores the
 * prior non-wildcard selection so the user doesn't lose their picks if
 * they tried "subscribe to everything" and changed their mind.
 *
 * Returns ALWAYS at least one element when valid — the empty array is
 * the dialog's "user hasn't picked anything yet" state and is rejected
 * by the caller before submit.
 */
export function WebhookEventTypePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const isWildcard = value.includes(WEBHOOK_WILDCARD);
  /** Last non-wildcard selection, restored when user toggles wildcard off. */
  const memo = useRef<string[]>([]);

  const grouped = useMemo(() => {
    type Entry = (typeof WEBHOOK_EVENT_CATALOGUE)[number];
    const map = new Map<Category, Entry[]>();
    for (const entry of WEBHOOK_EVENT_CATALOGUE) {
      const arr = map.get(entry.category) ?? [];
      arr.push(entry);
      map.set(entry.category, arr);
    }
    return Array.from(map.entries());
  }, []);

  const toggleWildcard = () => {
    if (disabled) return;
    if (isWildcard) {
      // Unchecking wildcard → restore prior explicit picks.
      onChange(memo.current.length ? memo.current : []);
    } else {
      // Going wildcard → remember current explicit picks for the way back.
      memo.current = value.filter((v) => v !== WEBHOOK_WILDCARD);
      onChange([WEBHOOK_WILDCARD]);
    }
  };

  const toggleEvent = (wire: string) => {
    if (disabled || isWildcard) return;
    const present = value.includes(wire);
    onChange(present ? value.filter((v) => v !== wire) : [...value, wire]);
  };

  return (
    <div>
      <label className="op-label mb-1.5 block">events</label>

      {/* Wildcard row — first-class state. */}
      <label
        className={`flex items-start gap-3 rounded-box border px-3 py-2.5 transition-colors ${
          isWildcard
            ? "border-primary/30 bg-[var(--op-accent-soft)]"
            : "border-base-300 bg-base-200 hover:bg-[var(--op-bg-hover)]"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          className="checkbox checkbox-sm mt-0.5"
          checked={isWildcard}
          onChange={toggleWildcard}
          disabled={disabled}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="font-mono-op text-[0.875rem] tabular-nums"
              style={{ color: isWildcard ? "var(--op-accent)" : undefined }}
            >
              *
            </span>
            <span className="text-[0.8125rem] font-medium">
              All current and future events
            </span>
          </div>
          <p className="mt-0.5 text-[0.6875rem] text-base-content/55">
            New event types added to MsgBuddy in future releases will be
            delivered automatically — no config update required.
          </p>
        </div>
      </label>

      {/* Explicit event rows, grouped by category. */}
      <div
        className={`mt-3 space-y-3 transition-opacity ${
          isWildcard ? "pointer-events-none opacity-35" : ""
        }`}
        aria-hidden={isWildcard}
      >
        {grouped.map(([category, entries]) => (
          <section key={category}>
            <span className="op-label mb-1.5 block">{category}</span>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {entries.map((e) => {
                const checked = value.includes(e.value);
                return (
                  <label
                    key={e.value}
                    className={`flex items-start gap-2.5 rounded-box border px-2.5 py-2 ${
                      checked
                        ? "border-base-300 bg-[var(--op-bg-2)]"
                        : "border-base-300/60 bg-transparent hover:bg-base-200"
                    } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                    title={e.hint}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm mt-0.5"
                      checked={checked && !isWildcard}
                      onChange={() => toggleEvent(e.value)}
                      disabled={disabled || isWildcard}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono-op text-[0.78125rem] tabular-nums">
                        {e.value}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-2 font-mono-op text-[0.6875rem] tracking-[0.04em] text-base-content/40">
        {isWildcard
          ? "subscribed to every event including future additions"
          : `${value.length} of ${WEBHOOK_EVENT_CATALOGUE.length} events selected`}
      </p>
    </div>
  );
}
