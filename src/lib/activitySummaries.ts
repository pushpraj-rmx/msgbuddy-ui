/**
 * Turns raw workspace audit-log rows into human sentences for the activity
 * UI ("Retried failed recipients — 8 re-queued, 3 skipped"), with a generic
 * fallback for actions we haven't special-cased. Pure — unit-testable.
 */
import type { AuditLogRow } from "./api";

export interface ActivitySummary {
  /** Short human title, e.g. "Retried failed recipients". */
  title: string;
  /** Optional detail sentence built from the captured response payload. */
  detail: string | null;
  /** Visual tone for the row marker. */
  tone: "default" | "info" | "warning" | "error";
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v ? v : null;
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;

/** Route matchers — matched against `action` ("METHOD /route/with/:params"). */
function matches(action: string, method: string, suffix: string): boolean {
  return action.startsWith(`${method} `) && action.endsWith(suffix);
}

export function describeActivity(row: AuditLogRow): ActivitySummary {
  const a = row.action;
  const after = obj(row.after);

  // ——— campaigns: manual actions ———
  if (matches(a, "POST", "/retry-failed")) {
    const send = num(after?.retriedSend);
    const delivery = num(after?.retriedDelivery);
    const skipped = num(after?.skippedPermanent);
    const total = num(after?.retriedCount);
    const parts: string[] = [];
    if (send) parts.push(`${send} re-queued to send`);
    if (delivery) parts.push(`${delivery} re-sent for delivery`);
    if (skipped) parts.push(`${skipped} skipped (permanent)`);
    return {
      title: "Retried failed recipients",
      detail:
        parts.length > 0
          ? parts.join(", ")
          : total === 0
            ? "Nothing eligible to retry"
            : null,
      tone: "info",
    };
  }
  if (matches(a, "POST", "/follow-up")) {
    const seeded = num(after?.seededContacts);
    const skipped = num(after?.skippedPermanent);
    const name = str(obj(after?.campaign)?.name);
    return {
      title: `Created follow-up draft${name ? ` “${name}”` : ""}`,
      detail:
        seeded != null
          ? `${plural(seeded, "contact")} staged${skipped ? `, ${skipped} permanent left out` : ""} — nothing sends until started`
          : null,
      tone: "info",
    };
  }
  if (matches(a, "POST", "/campaigns/:id/start")) {
    return { title: "Started campaign", detail: null, tone: "default" };
  }
  if (matches(a, "POST", "/pause")) {
    return { title: "Paused campaign", detail: null, tone: "warning" };
  }
  if (matches(a, "POST", "/resume")) {
    return { title: "Resumed campaign", detail: null, tone: "default" };
  }
  if (matches(a, "POST", "/cancel")) {
    return { title: "Cancelled campaign", detail: null, tone: "error" };
  }
  if (matches(a, "POST", "/duplicate")) {
    return { title: "Duplicated campaign", detail: null, tone: "default" };
  }
  if (matches(a, "POST", "/recover-stuck")) {
    const recovered = num(after?.recoveredCount);
    return {
      title: "Recovered stuck jobs",
      detail: recovered != null ? `${plural(recovered, "job")} reset` : null,
      tone: "warning",
    };
  }
  if (a === "POST /campaigns") {
    const name = str(after?.name);
    return {
      title: `Created campaign${name ? ` “${name}”` : ""}`,
      detail: null,
      tone: "default",
    };
  }
  if (matches(a, "PUT", "/campaigns/:id")) {
    return { title: "Updated campaign", detail: null, tone: "default" };
  }
  if (matches(a, "DELETE", "/campaigns/:id")) {
    return { title: "Deleted campaign", detail: null, tone: "error" };
  }

  // ——— campaigns: system (auto-retry) ———
  if (a === "SYSTEM campaign.autoretry.scheduled") {
    const round = num(after?.round);
    const total = num(after?.totalRounds);
    const at = str(after?.nextRetryAt);
    const eligible = num(after?.autoRetryable);
    return {
      title: `Auto-retry scheduled${round ? ` — round ${round}${total ? ` of ${total}` : ""}` : ""}`,
      detail:
        (at ? `Runs ${new Date(at).toLocaleString()}` : null) +
        (eligible != null
          ? `${at ? " · " : ""}${plural(eligible, "recipient")} eligible`
          : ""),
      tone: "info",
    };
  }
  if (a === "SYSTEM campaign.autoretry.executed") {
    const round = num(after?.round);
    const send = num(after?.retriedSend);
    const delivery = num(after?.retriedDelivery);
    const parts: string[] = [];
    if (send) parts.push(`${send} re-queued to send`);
    if (delivery) parts.push(`${delivery} re-sent for delivery`);
    return {
      title: `Auto-retry ran${round ? ` — round ${round}` : ""}`,
      detail: parts.length ? parts.join(", ") : "Nothing eligible remained",
      tone: "info",
    };
  }
  if (a === "SYSTEM campaign.autoretry.exhausted") {
    const reason = str(after?.reason);
    const still = num(after?.stillFailing);
    const title =
      reason === "category_manual_only"
        ? "Auto-retry skipped — authentication templates are manual-only"
        : "Auto-retry finished — no more rounds";
    return {
      title,
      detail:
        still != null && still > 0
          ? `${plural(still, "recipient")} still failing — retry manually or create a follow-up`
          : null,
      tone: "warning",
    };
  }

  // ——— generic fallback ———
  if (a.startsWith("SYSTEM ")) {
    return { title: a.replace(/^SYSTEM /, "System: "), detail: null, tone: "default" };
  }
  return { title: `${row.method} ${row.route}`, detail: null, tone: "default" };
}

/** Human actor label; pass a userId→name map when available. */
export function describeActor(
  row: AuditLogRow,
  memberNames?: Map<string, string>,
  currentUserId?: string | null,
): string {
  if (row.actor === "system") return "System";
  if (row.actorUserId) {
    if (currentUserId && row.actorUserId === currentUserId) return "You";
    return memberNames?.get(row.actorUserId) ?? "Team member";
  }
  if (row.actorApiKeyId) return "API key";
  return "Unknown";
}
