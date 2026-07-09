"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { getApiError } from "@/lib/api-error";

export function NotificationPreferencesClient({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { permission, enabled, enable, disable } = usePushSubscription(workspaceId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const denied = permission === "denied";

  const onToggle = async () => {
    setError(null);
    setBusy(true);
    try {
      if (enabled) {
        await disable();
      } else {
        const result = await enable();
        if (result === "denied") {
          setError(
            "Your browser has blocked notifications. Allow them in your browser's site settings, then try again.",
          );
        } else if (result === "unsupported") {
          setError("This browser doesn't support push notifications.");
        } else if (result === "default") {
          setError("Notification permission wasn't granted. Try again to turn on notifications.");
        }
      }
    } catch (err: unknown) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-box border border-base-300 bg-base-200">
      <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-base-content/55" />
          <div>
            <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">
              Push notifications
            </h3>
            <p className="mt-0.5 text-[0.71875rem] text-base-content/55">
              Get alerted about new messages even when this tab is closed. Off by
              default — applies to this browser only.
            </p>
          </div>
        </div>
        <input
          type="checkbox"
          role="switch"
          className="toggle toggle-primary shrink-0"
          checked={enabled}
          disabled={busy || denied}
          onChange={onToggle}
          aria-label="Enable push notifications"
        />
      </div>

      {denied ? (
        <div className="border-t border-base-300 px-4 py-2.5 text-[0.8125rem] text-warning sm:px-5">
          Notifications are blocked in your browser. Allow them in your browser&apos;s
          site settings to turn this on.
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="border-t border-base-300 px-4 py-2.5 sm:px-5">
          <span className="op-label mb-1 block text-error">error</span>
          <span className="text-[0.8125rem] text-base-content">{error}</span>
        </div>
      ) : null}
    </div>
  );
}
