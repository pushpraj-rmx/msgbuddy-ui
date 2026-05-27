"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { campaignsApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";

/**
 * Mount-time: POSTs an empty DRAFT campaign and replaces the URL with the
 * edit route. This keeps the wizard's persistence model uniform — it always
 * operates on a known `campaignId`, so every step transition can PUT updates.
 *
 * Why bootstrap instead of POST-on-submit: lets users leave and resume
 * mid-flow without losing state (the original gap), and gives every draft a
 * stable URL we can link back to from the campaigns list.
 */
export function NewCampaignBootstrap() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Strict-mode double-invoke guard.
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    void campaignsApi
      .create({
        // Friendly placeholder; user can rename on step 1 or from the detail
        // page. We don't want an empty-string name because the DTO requires
        // MinLength(1).
        name: `Untitled draft · ${new Date().toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}`,
        channel: "WHATSAPP",
        audienceType: "ALL",
      })
      .then((created) => {
        if (cancelled) return;
        const c = created as { id: string };
        router.replace(`/campaigns/${encodeURIComponent(c.id)}/edit`);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getApiError(err) || "Failed to start a new campaign draft.");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
        <p className="text-sm font-medium text-error">
          Could not create draft
        </p>
        <p className="mt-1 text-sm">{error}</p>
        <div className="mt-3">
          <Link href="/campaigns" className="btn btn-ghost btn-sm">
            ← Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm text-base-content/65">
      <span className="loading loading-spinner loading-sm" />
      Preparing your draft…
    </div>
  );
}
