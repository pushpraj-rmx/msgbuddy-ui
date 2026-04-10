"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { feedbackApi } from "@/lib/api";
import type { FeedbackReport, FeedbackType, FeedbackStatus } from "@/lib/types";
import { FeedbackCard } from "./FeedbackCard";
import { FeedbackFormModal } from "./FeedbackFormModal";
import { FeedbackDetailModal } from "./FeedbackDetailModal";
import { canAccessPlatform } from "@/lib/platform-access";

const TYPE_FILTERS: { value: FeedbackType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "BUG", label: "Bugs" },
  { value: "FEATURE_REQUEST", label: "Features" },
];

const STATUS_FILTERS: { value: FeedbackStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Any Status" },
  { value: "OPEN", label: "Open" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DONE", label: "Done" },
  { value: "WONT_FIX", label: "Won't Fix" },
];

interface FeedbackClientProps {
  platformRole: string;
  userId: string;
}

export function FeedbackClient({ platformRole, userId }: FeedbackClientProps) {
  const isAdmin = canAccessPlatform(platformRole);

  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<FeedbackType>("BUG");
  const [selectedReport, setSelectedReport] = useState<FeedbackReport | null>(null);

  const query = useQuery({
    queryKey: ["feedback", tab, typeFilter, statusFilter, page],
    queryFn: () =>
      feedbackApi.list({
        ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        page,
        limit,
        ...(tab === "all" && isAdmin ? { all: true } : {}),
      }),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function openForm(type: FeedbackType) {
    setFormType(type);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="join">
            <button
              type="button"
              className={`btn btn-sm join-item ${tab === "mine" ? "btn-primary" : "btn-outline"}`}
              onClick={() => { setTab("mine"); setPage(1); }}
            >
              My Reports
            </button>
            {isAdmin && (
              <button
                type="button"
                className={`btn btn-sm join-item ${tab === "all" ? "btn-primary" : "btn-outline"}`}
                onClick={() => { setTab("all"); setPage(1); }}
              >
                All Reports
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-error btn-outline"
            onClick={() => openForm("BUG")}
          >
            Report a Bug
          </button>
          <button
            type="button"
            className="btn btn-sm btn-info btn-outline"
            onClick={() => openForm("FEATURE_REQUEST")}
          >
            Request a Feature
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="join">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`btn btn-xs join-item ${typeFilter === f.value ? "btn-primary" : "btn-outline"}`}
              onClick={() => { setTypeFilter(f.value); setPage(1); }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          className="select select-bordered select-xs"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as FeedbackStatus | "ALL"); setPage(1); }}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {query.isLoading ? (
        <div className="text-sm text-base-content/60">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card border border-base-300 bg-base-100">
          <div className="card-body items-center justify-center py-16 text-center">
            <p className="text-base-content/50 text-sm">No reports found.</p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => openForm("BUG")}
              >
                Report a Bug
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => openForm("FEATURE_REQUEST")}
              >
                Request a Feature
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((report) => (
            <FeedbackCard
              key={report.id}
              report={report}
              isOwn={report.userId === userId}
              onClick={() => setSelectedReport(report)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-base-content/50">
            Page {page} of {totalPages} · {total} reports
          </span>
          <div className="join">
            <button
              type="button"
              className="btn btn-xs join-item"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <button
              type="button"
              className="btn btn-xs join-item"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {formOpen && (
        <FeedbackFormModal
          initialType={formType}
          onClose={() => setFormOpen(false)}
        />
      )}
      {selectedReport && (
        <FeedbackDetailModal
          report={selectedReport}
          isAdmin={isAdmin}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}
