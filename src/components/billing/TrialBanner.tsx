"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Workspace } from "@/lib/api";

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function TrialBanner({ workspace }: { workspace: Workspace }) {
  const [dismissed, setDismissed] = useState(false);

  if (workspace.status !== "TRIAL" || !workspace.trialEndsAt) return null;
  if (dismissed) return null;

  const days = daysUntil(workspace.trialEndsAt);
  if (days === null) return null;

  const urgent = days <= 3;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${
        urgent
          ? "bg-warning/15 text-warning-content"
          : "bg-primary/10 text-primary-content"
      }`}
    >
      <p>
        {days === 0 ? (
          <span className="font-medium">
            Your Growth trial expires today.
          </span>
        ) : (
          <>
            <span className="font-medium">{days} day{days !== 1 ? "s" : ""}</span>{" "}
            left in your Growth trial.
          </>
        )}{" "}
        Upgrade to keep all features.
      </p>
      <div className="flex items-center gap-2">
        <Link
          href="/billing#plans"
          className={`btn btn-xs ${urgent ? "btn-warning" : "btn-primary"}`}
        >
          Upgrade now
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
