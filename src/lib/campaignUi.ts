/** Normalized lifecycle / outcome for styling (not exhaustive). */
export type CampaignStatusTone =
  | "success"
  | "running"
  | "warning"
  | "danger"
  | "neutral";

export function normalizeStatus(status: string): string {
  return status.trim().toUpperCase().replace(/\s+/g, "_");
}

export function campaignStatusTone(status: string): CampaignStatusTone {
  const s = normalizeStatus(status);
  if (
    s === "COMPLETED" ||
    s === "SUCCESS" ||
    s === "SUCCEEDED" ||
    s === "DONE"
  ) {
    return "success";
  }
  if (
    s === "RUNNING" ||
    s === "IN_PROGRESS" ||
    s === "PROCESSING" ||
    s === "ACTIVE"
  ) {
    return "running";
  }
  if (s === "PAUSED" || s === "SCHEDULED" || s === "PENDING" || s === "QUEUED") {
    return "warning";
  }
  if (s === "FAILED" || s === "CANCELLED" || s === "CANCELED" || s === "ERROR") {
    return "danger";
  }
  return "neutral";
}

export function statusBadgeClasses(tone: CampaignStatusTone): string {
  switch (tone) {
    case "success":
      return "badge-success";
    case "running":
      return "badge-info";
    case "warning":
      return "badge-warning";
    case "danger":
      return "badge-error";
    default:
      return "badge-neutral";
  }
}

/** Neutral surface; color only on left accent (badge carries semantic color). */
export function statusHeroClasses(tone: CampaignStatusTone): string {
  const accent =
    tone === "success"
      ? "border-l-[6px] border-l-success"
      : tone === "running"
        ? "border-l-[6px] border-l-info"
        : tone === "warning"
          ? "border-l-[6px] border-l-warning"
          : tone === "danger"
            ? "border-l-[6px] border-l-error"
            : "border-l-[6px] border-l-base-300";
  return `rounded-box border-y border-r border-base-300/80 bg-base-100 ${accent}`;
}

export function statusDotClasses(tone: CampaignStatusTone): string {
  switch (tone) {
    case "success":
      return "bg-success";
    case "running":
      return "bg-info";
    case "warning":
      return "bg-warning";
    case "danger":
      return "bg-error";
    default:
      return "bg-base-content/35";
  }
}

const NESTED_METRIC_KEYS = [
  "summary",
  "metrics",
  "stats",
  "data",
  "result",
  "campaign",
  "delivery",
  "report",
  "analytics",
] as const;

/** Pull common one-level nested objects up so totals survive oddly shaped APIs. */
function flattenReportForMetrics(
  report: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...report };
  for (const nk of NESTED_METRIC_KEYS) {
    const v = report[nk];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (!(k in out) || out[k] === undefined || out[k] === null) {
          out[k] = val;
        }
      }
    }
  }
  return out;
}

/** List row title — short date when name is auto-generated. */
export function formatCampaignListTitle(name: string, maxLen = 44): string {
  const t = name.trim();
  const isoLike =
    /^Campaign\s+[·.]?\s*\d{4}/.test(t) ||
    /^Campaign\s+\d{4}-\d{2}-\d{2}T/.test(t) ||
    /^\d{4}-\d{2}-\d{2}T/.test(t);
  if (isoLike) {
    const match = t.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const d = new Date(match[1]);
      if (!Number.isNaN(d.getTime())) {
        const short = `Campaign – ${d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;
        return short.length > maxLen ? `${short.slice(0, maxLen - 1)}…` : short;
      }
    }
    return "Campaign";
  }
  return t.length > maxLen ? `${t.slice(0, maxLen - 1)}…` : t;
}

/** Main headline — a bit friendlier than the raw server string. */
export function formatCampaignHeroTitle(name: string, maxLen = 100): string {
  const t = name.trim();
  const isoLike =
    /^Campaign\s+[·.]?\s*\d{4}/.test(t) ||
    /^Campaign\s+\d{4}-\d{2}-\d{2}T/.test(t);
  if (isoLike) {
    const match = t.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const d = new Date(match[1]);
      if (!Number.isNaN(d.getTime())) {
        const line = `Campaign · ${d.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}`;
        return line.length > maxLen ? `${line.slice(0, maxLen - 1)}…` : line;
      }
    }
  }
  return t.length > maxLen ? `${t.slice(0, maxLen - 1)}…` : t;
}

/** Short line under the badge — outcome-focused, not internal jargon. */
export function campaignOutcomeLine(
  tone: CampaignStatusTone,
  metrics: ReportMetrics,
  progress: {
    completedJobs?: number;
    totalJobs?: number;
  } | null
): string | null {
  const total = metrics.totalJobs ?? progress?.totalJobs;
  const done = metrics.completed ?? progress?.completedJobs;
  switch (tone) {
    case "success":
      if (total != null && done != null && total > 0 && done >= total) {
        return "All sends finished — nothing left in the queue.";
      }
      if (total != null && done != null) {
        return `${done} of ${total} sends completed.`;
      }
      return "This run finished.";
    case "running":
      return "Sending messages now — you can pause or cancel below.";
    case "danger":
      return "This run stopped with errors. Check the numbers below.";
    case "warning":
      return "Waiting to send or temporarily paused.";
    default:
      return null;
  }
}

export function showStart(status: string): boolean {
  const s = normalizeStatus(status);
  return (
    s === "DRAFT" ||
    s === "READY" ||
    s === "SCHEDULED" ||
    s === "QUEUED" ||
    s === "PENDING"
  );
}

export function showResume(status: string): boolean {
  return normalizeStatus(status) === "PAUSED";
}

export function showPause(status: string): boolean {
  const s = normalizeStatus(status);
  return (
    s === "RUNNING" ||
    s === "IN_PROGRESS" ||
    s === "ACTIVE" ||
    s === "PROCESSING"
  );
}

export function showCancel(status: string): boolean {
  const s = normalizeStatus(status);
  return (
    s === "RUNNING" ||
    s === "IN_PROGRESS" ||
    s === "ACTIVE" ||
    s === "PROCESSING" ||
    s === "PAUSED" ||
    s === "SCHEDULED" ||
    s === "QUEUED" ||
    s === "DRAFT" ||
    s === "PENDING"
  );
}

/** Stop / cancel the current run (not drafts). Matches API `CampaignStatus` (e.g. ACTIVE). */
export function showStopCampaign(status: string): boolean {
  const s = normalizeStatus(status);
  return (
    s === "RUNNING" ||
    s === "IN_PROGRESS" ||
    s === "ACTIVE" ||
    s === "PROCESSING" ||
    s === "PAUSED" ||
    s === "SCHEDULED" ||
    s === "QUEUED" ||
    s === "PENDING"
  );
}

/** Clear stuck BullMQ jobs for this campaign (recovery). */
export function showDrainQueue(status: string): boolean {
  const s = normalizeStatus(status);
  return (
    s === "RUNNING" ||
    s === "IN_PROGRESS" ||
    s === "ACTIVE" ||
    s === "PROCESSING" ||
    s === "PAUSED" ||
    s === "SCHEDULED" ||
    s === "QUEUED" ||
    s === "PENDING" ||
    s === "CANCELLED" ||
    s === "CANCELED"
  );
}

export type CampaignRunSummary = {
  totalJobs?: number;
  completedJobs?: number;
  failedJobs?: number;
  skippedJobs?: number;
  successRate?: number;
};

/** Compact one-line summary for campaign list rows and dashboard cards. */
export function campaignRunSummaryLine(
  tone: CampaignStatusTone,
  run: CampaignRunSummary | undefined,
): string | null {
  if (!run || run.totalJobs == null || run.totalJobs <= 0) return null;
  const total = run.totalJobs.toLocaleString();
  const done = (run.completedJobs ?? 0).toLocaleString();
  const pct =
    run.successRate != null
      ? ` · ${Math.round(run.successRate)}%`
      : run.totalJobs > 0 && run.completedJobs != null
        ? ` · ${Math.min(100, Math.round((run.completedJobs / run.totalJobs) * 100))}%`
        : "";

  if (tone === "danger") {
    const failed = run.failedJobs ?? 0;
    return failed > 0
      ? `${failed.toLocaleString()} failed of ${total}`
      : `${done} / ${total}${pct}`;
  }
  if (tone === "success" || tone === "running") {
    return `${done} / ${total} sent${pct}`;
  }
  return null;
}

export type ReportMetrics = {
  totalJobs?: number;
  completed?: number;
  failed?: number;
  delivered?: number;
  read?: number;
  messagesSent?: number;
  /** Any other top-level scalar fields we show in "raw" */
  extras: Record<string, unknown>;
};

function numVal(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return undefined;
}

/**
 * Pull known scalar metrics from analytics payload; remainder → extras for raw toggle.
 */
export function parseReportMetrics(
  report: Record<string, unknown> | null
): ReportMetrics {
  if (!report) {
    return { extras: {} };
  }
  const flat = flattenReportForMetrics(report);
  const extras: Record<string, unknown> = { ...flat };

  const pick = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      if (k in extras && extras[k] !== undefined) {
        const n = numVal(extras[k]);
        if (n !== undefined) {
          delete extras[k];
          return n;
        }
      }
    }
    return undefined;
  };

  const totalJobs = pick(
    "totalJobs",
    "total",
    "jobsTotal",
    "total_messages"
  );
  const completed = pick(
    "completed",
    "completedJobs",
    "completedCount",
    "successCount"
  );
  const failed = pick(
    "failed",
    "failedJobs",
    "failedCount",
    "failureCount"
  );
  const delivered = pick("delivered", "deliveredCount");
  const read = pick("read", "readCount");
  const messagesSent = pick("messagesSent", "sent", "sentCount");

  return {
    totalJobs,
    completed,
    failed,
    delivered,
    read,
    messagesSent,
    extras,
  };
}

/** Fill gaps using live progress when analytics payload is sparse. */
export function mergeReportWithProgress(
  metrics: ReportMetrics,
  progress: {
    completedJobs?: number;
    totalJobs?: number;
    progressPercent?: number;
  } | null
): ReportMetrics {
  if (!progress) return metrics;
  return {
    ...metrics,
    totalJobs: metrics.totalJobs ?? progress.totalJobs,
    completed: metrics.completed ?? progress.completedJobs,
    extras: metrics.extras,
  };
}

export function completionPercent(metrics: ReportMetrics): number | null {
  const { totalJobs, completed } = metrics;
  if (
    totalJobs == null ||
    totalJobs <= 0 ||
    completed == null ||
    completed < 0
  ) {
    return null;
  }
  return Math.min(100, Math.round((completed / totalJobs) * 100));
}
