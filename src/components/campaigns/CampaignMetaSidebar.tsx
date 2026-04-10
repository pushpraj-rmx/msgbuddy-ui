"use client";

import { statusBadgeClasses } from "@/lib/campaignUi";
import type { CampaignStatusTone } from "@/lib/campaignUi";

type CampaignRun = {
  id: string;
  status?: string;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  totalJobs?: number;
};

type MergedMetrics = {
  totalJobs?: number | null;
  messagesSent?: number | null;
  delivered?: number | null;
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-base-content/50">
        {label}
      </span>
      <span className="text-sm text-base-content">{value}</span>
    </div>
  );
}

export function CampaignMetaSidebar({
  status,
  channel,
  tone,
  runs,
  mergedMetrics,
}: {
  status: string;
  channel: string;
  tone: CampaignStatusTone;
  runs: CampaignRun[];
  mergedMetrics: MergedMetrics;
}) {
  const lastRun = runs[0] ?? null;
  const runCount = runs.length;
  const totalJobs = mergedMetrics.totalJobs;
  const sent = mergedMetrics.messagesSent ?? mergedMetrics.delivered;

  return (
    <div className="flex flex-col gap-5 py-1">
      <Row
        label="Status"
        value={
          <span className={`badge badge-sm ${statusBadgeClasses(tone)}`}>
            {status}
          </span>
        }
      />
      <Row label="Channel" value={channel} />
      {totalJobs != null && (
        <Row label="Recipients" value={totalJobs.toLocaleString()} />
      )}
      {sent != null && (
        <Row label="Messages sent" value={sent.toLocaleString()} />
      )}
      <Row label="Runs" value={runCount > 0 ? runCount : "—"} />
      {lastRun && (
        <>
          <Row
            label="Last run started"
            value={fmtDate(lastRun.startedAt ?? lastRun.createdAt)}
          />
          {lastRun.endedAt && (
            <Row label="Last run ended" value={fmtDate(lastRun.endedAt)} />
          )}
          {lastRun.status && (
            <Row label="Last run status" value={lastRun.status} />
          )}
        </>
      )}
    </div>
  );
}
