import type { ReactNode } from "react";

/**
 * Operator status capsule. Replaces DaisyUI badge-* across the app.
 *
 * Tones are independent from semantic colors — they describe lifecycle/intent:
 *   success  → completed / done
 *   running  → active send, healthy in-flight
 *   warning  → paused / scheduled / pending
 *   danger   → failed / cancelled / errored
 *   info     → informational, non-semantic
 *   neutral  → resting state, default
 */
export type StatusTagTone =
  | "success"
  | "running"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const TONE_CLASS: Record<StatusTagTone, string> = {
  success: "op-tag-ok",
  running: "op-tag-ok",
  warning: "op-tag-warn",
  danger:  "op-tag-danger",
  info:    "op-tag-info",
  neutral: "",
};

export function StatusTag({
  tone = "neutral",
  className,
  children,
}: {
  tone?: StatusTagTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`op-tag ${TONE_CLASS[tone]}${className ? ` ${className}` : ""}`}>
      {children}
    </span>
  );
}
