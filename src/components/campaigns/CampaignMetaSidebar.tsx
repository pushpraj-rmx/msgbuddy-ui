"use client";

import type { CampaignStatusTone } from "@/lib/campaignUi";
import type { ChannelTemplateVersion } from "@/lib/types";
import { StatusTag, type StatusTagTone } from "@/components/ui/StatusTag";
import { WhatsAppTemplatePreviewFromVersion } from "@/components/templates/WhatsAppTemplatePreview";

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

function toneToTag(tone: CampaignStatusTone): StatusTagTone {
  switch (tone) {
    case "success": return "success";
    case "running": return "running";
    case "warning": return "warning";
    case "danger":  return "danger";
    default:        return "neutral";
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="op-label">{label}</span>
      <span className="text-[0.8125rem] text-base-content">{value}</span>
    </div>
  );
}

function MonoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="op-label">{label}</span>
      <span className="font-mono-op text-[0.78125rem] tabular-nums text-base-content">{value}</span>
    </div>
  );
}

export function CampaignMetaSidebar({
  status,
  channel,
  tone,
  runs,
  mergedMetrics,
  templateVersion,
}: {
  status: string;
  channel: string;
  tone: CampaignStatusTone;
  runs: CampaignRun[];
  mergedMetrics: MergedMetrics;
  templateVersion?: ChannelTemplateVersion | null;
}) {
  const lastRun = runs[0] ?? null;
  const runCount = runs.length;
  const totalJobs = mergedMetrics.totalJobs;
  const sent = mergedMetrics.messagesSent ?? mergedMetrics.delivered;

  return (
    <div className="flex flex-col gap-5 py-1">
      <Row
        label="Status"
        value={<StatusTag tone={toneToTag(tone)}>{status}</StatusTag>}
      />
      <Row label="Channel" value={channel} />
      {totalJobs != null && (
        <MonoRow label="Recipients" value={totalJobs.toLocaleString()} />
      )}
      {sent != null && (
        <MonoRow label="Messages sent" value={sent.toLocaleString()} />
      )}
      <MonoRow label="Runs" value={runCount > 0 ? runCount : "—"} />
      {lastRun && (
        <>
          <MonoRow
            label="Last run started"
            value={fmtDate(lastRun.startedAt ?? lastRun.createdAt)}
          />
          {lastRun.endedAt && (
            <MonoRow label="Last run ended" value={fmtDate(lastRun.endedAt)} />
          )}
          {lastRun.status && (
            <Row label="Last run status" value={lastRun.status} />
          )}
        </>
      )}
      {templateVersion && (
        <div className="flex flex-col gap-1.5 border-t border-base-300 pt-4">
          <span className="op-label">Message preview</span>
          <WhatsAppTemplatePreviewFromVersion
            version={templateVersion}
            className="w-full rounded-box border border-base-300 border-l-2 border-l-success bg-base-100 p-2.5 space-y-2"
          />
        </div>
      )}
    </div>
  );
}
