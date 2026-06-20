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
      className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-[0.8125rem] ${
        urgent
          ? "border-warning/40 bg-warning/10 text-base-content"
          : "border-base-300 bg-base-200 text-base-content"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`op-label ${urgent ? "text-warning" : "text-primary"}`}
        >
          {urgent ? "trial · ending" : "trial"}
        </span>
        <p className="text-base-content/85">
          {days === 0 ? (
            <span className="font-semibold">Your Growth trial expires today.</span>
          ) : (
            <>
              <span className="font-mono-op font-semibold tabular-nums">{days}</span>{" "}
              day{days !== 1 ? "s" : ""} left in your Growth trial.
            </>
          )}{" "}
          <span className="text-base-content/60">Upgrade to keep all features (auto-downgrades to Free after expiry).</span>
        </p>
      </div>
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
