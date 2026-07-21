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

  if (matches(a, "PUT", "/sending-number")) {
    const n = str(after?.sendingNumber);
    return {
      title: "Changed a conversation's sending number",
      detail: n ? `Now sends from ${n}` : null,
      tone: "default",
    };
  }

  // ——— other system decisions ———
  if (a === "SYSTEM campaign.scheduled_start") {
    const name = str(after?.name);
    return {
      title: `Campaign started as scheduled${name ? ` — “${name}”` : ""}`,
      detail: null,
      tone: "default",
    };
  }
  if (a === "SYSTEM conversation.assignment_expired") {
    const count = num(after?.count);
    return {
      title: `Auto-unassigned ${count != null ? plural(count, "conversation") : "conversations"} after inactivity`,
      detail: "Waiting customers were returned to the unassigned queue",
      tone: "warning",
    };
  }
  if (a === "SYSTEM template.status_changed") {
    const to = str(after?.to) ?? "";
    const from = str(after?.from);
    const reason = str(after?.rejectionReason);
    const pretty = to.replace(/^PROVIDER_/, "").toLowerCase();
    const bad = /REJECTED|DISABLED|PAUSED/.test(to);
    return {
      title: `Template ${pretty || "status changed"} by Meta`,
      detail:
        (from ? `${from.replace(/^PROVIDER_/, "")} → ${to.replace(/^PROVIDER_/, "")}` : null) +
        (reason ? ` · Reason: ${reason}` : ""),
      tone: bad ? "error" : "info",
    };
  }
  if (a === "SYSTEM channel.phone_quality_changed") {
    const from = str(after?.from) ?? "unknown";
    const to = str(after?.to) ?? "unknown";
    const bad = to === "RED" || to === "FLAGGED" || to === "YELLOW";
    return {
      title: `WhatsApp number quality changed: ${from} → ${to}`,
      detail: bad
        ? "Lower quality can reduce your messaging limits — slow down sends and review recent templates"
        : null,
      tone: to === "GREEN" ? "info" : bad ? "error" : "default",
    };
  }
  if (a === "SYSTEM channel.utility_restriction_changed") {
    const to = str(after?.to);
    return {
      title: to
        ? `WhatsApp account restriction: ${to}`
        : "WhatsApp account restriction cleared",
      detail: to
        ? "Meta flagged utility-template usage — review recent utility sends"
        : null,
      tone: to ? "error" : "info",
    };
  }
  if (a === "SYSTEM workspace.trial_expired") {
    return {
      title: "Trial ended — downgraded to the Free plan",
      detail: "Upgrade any time to restore your previous limits",
      tone: "warning",
    };
  }
  if (a === "SYSTEM webhook_endpoint.auto_disabled") {
    const url = str(after?.url);
    const failures = num(after?.consecutiveFailures);
    return {
      title: "Webhook endpoint auto-disabled",
      detail:
        `${url ?? "Endpoint"} kept failing${failures != null ? ` (${failures} consecutive failures)` : ""} — fix the receiver and re-enable it in Settings → Developers`,
      tone: "error",
    };
  }

  if (a === "SYSTEM workspace.provisioned") {
    const email = str(after?.clientEmail);
    return {
      title: "Workspace provisioned for a client",
      detail: email ? `Invite sent to ${email} — ownership transfers when they accept` : null,
      tone: "info",
    };
  }
  if (a === "SYSTEM workspace.ownership_transferred") {
    return {
      title: "Workspace ownership transferred to the client",
      detail: "They accepted their invitation and are now the OWNER",
      tone: "info",
    };
  }

  if (a === "SYSTEM channel.number_moved_out") {
    const n = str(after?.number);
    return {
      title: `WhatsApp number ${n ?? ""} moved out of this workspace`.replace("  ", " "),
      detail: "Inbound messages for it now route to its new workspace; existing conversations stay here",
      tone: "warning",
    };
  }
  if (a === "SYSTEM channel.number_moved_in") {
    const n = str(after?.number);
    return {
      title: `WhatsApp number ${n ?? ""} moved into this workspace`.replace("  ", " "),
      detail: "Inbound messages for it now arrive here",
      tone: "info",
    };
  }

  if (a === "SYSTEM channel.number_connected_manually") {
    const n = str(after?.number);
    const sub = after && (after as Record<string, unknown>).subscribed === true;
    return {
      title: `WhatsApp number ${n ?? ""} connected manually`.replace("  ", " "),
      detail: sub
        ? "Connected by the platform team — webhooks subscribed, inbound messages will flow"
        : "Connected by the platform team — webhook subscription pending",
      tone: "info",
    };
  }

  if (a === "SYSTEM channel.default_number_changed") {
    const n = str(after?.number);
    return {
      title: `Default sending number changed${n ? ` to ${n}` : ""}`,
      detail: "Inbox replies and campaigns without a specific number now send from it",
      tone: "default",
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
