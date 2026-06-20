"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { feedbackApi } from "@/lib/api";
import type { FeedbackReport } from "@/lib/types";
import { StatusTag } from "@/components/ui/StatusTag";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatRelative(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const abs = diffSec;
  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return fmt.format(-diffSec, "second");
  if (abs < 3600) return fmt.format(-Math.round(diffSec / 60), "minute");
  if (abs < 86400) return fmt.format(-Math.round(diffSec / 3600), "hour");
  return fmt.format(-Math.round(diffSec / 86400), "day");
}

const STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  OPEN: "neutral",
  IN_REVIEW: "info",
  PLANNED: "info",
  IN_PROGRESS: "warning",
  DONE: "success",
  WONT_FIX: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  WONT_FIX: "Won't Fix",
};

const PRIORITY_TONE: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  CRITICAL: "danger",
};

interface FeedbackCardProps {
  report: FeedbackReport;
  onClick: () => void;
  isOwn: boolean;
}

export function FeedbackCard({ report, onClick, isOwn }: FeedbackCardProps) {
  const queryClient = useQueryClient();

  const toggleVote = useMutation({
    mutationFn: () =>
      report.hasVoted ? feedbackApi.unvote(report.id) : feedbackApi.vote(report.id),
    onSuccess: (data) => {
      queryClient.setQueriesData<{ items: FeedbackReport[] }>(
        { queryKey: ["feedback"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((r) =>
              r.id === report.id
                ? { ...r, voteCount: data.voteCount, hasVoted: data.hasVoted }
                : r
            ),
          };
        }
      );
    },
  });

  const preview = stripHtml(report.description).slice(0, 120);

  return (
    <article
      className="rounded-box border border-base-300 bg-base-100 transition-colors hover:border-base-content/20 cursor-pointer"
      onClick={onClick}
    >
      <div className="card-body gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusTag tone={report.type === "BUG" ? "danger" : "info"}>
            {report.type === "BUG" ? "Bug" : "Feature"}
          </StatusTag>
          <StatusTag tone={STATUS_TONE[report.status] ?? "neutral"}>
            {STATUS_LABEL[report.status] ?? report.status}
          </StatusTag>
          {report.type === "BUG" && (
            <StatusTag tone={PRIORITY_TONE[report.priority] ?? "neutral"}>
              {report.priority.charAt(0) + report.priority.slice(1).toLowerCase()}
            </StatusTag>
          )}
        </div>

        <h2 className="font-semibold text-sm leading-snug line-clamp-2">{report.title}</h2>

        {preview && (
          <p className="text-xs text-base-content/60 line-clamp-2">{preview}</p>
        )}

        <div className="flex items-center justify-between mt-1">
          <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/50">
            {report.submittedBy ? `${report.submittedBy} · ` : ""}
            {formatRelative(report.createdAt)}
          </span>

          {report.type === "FEATURE_REQUEST" && (
            <button
              type="button"
              className={`btn btn-xs gap-1 ${report.hasVoted ? "btn-primary" : "btn-outline"} ${isOwn ? "opacity-60" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isOwn) toggleVote.mutate();
              }}
              disabled={toggleVote.isPending || isOwn}
              title={isOwn ? "Can't vote on your own report" : report.hasVoted ? "Remove vote" : "Vote for this feature request"}
            >
              ▲ Vote · {report.voteCount}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
