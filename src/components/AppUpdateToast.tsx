"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * Polls /api/version every 60s (and on window focus). When the deployed build ID
 * differs from the one this tab was loaded with, shows a toast prompting reload.
 *
 * Use case: PWA users on mobile may keep the app open for days. This makes new
 * versions discoverable without forcing a reload.
 */

const POLL_INTERVAL_MS = 60_000;

const CURRENT_VERSION =
  process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export function AppUpdateToast() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const latest = await fetchLatestVersion();
      if (cancelled) return;
      if (!latest || latest === CURRENT_VERSION) return;
      // Don't re-show if user already dismissed this exact version
      if (latest === dismissedVersion) return;
      setUpdateAvailable(true);
    };

    // Initial check
    check();

    // Poll on interval
    const interval = window.setInterval(check, POLL_INTERVAL_MS);

    // Re-check when tab becomes visible again
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dismissedVersion]);

  if (!updateAvailable) return null;

  const reload = () => {
    window.location.reload();
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex max-w-md items-center gap-3 rounded-box border border-base-300 bg-base-200 px-4 py-3 shadow-lg">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-100 text-primary">
          <RefreshCw className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <span className="op-label block text-primary">update available</span>
          <p className="mt-0.5 text-[12px] text-base-content/65">A new version of MsgBuddy is ready.</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={reload}
          >
            Reload
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-square"
            onClick={async () => {
              const latest = await fetchLatestVersion();
              if (latest) setDismissedVersion(latest);
              setUpdateAvailable(false);
            }}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
