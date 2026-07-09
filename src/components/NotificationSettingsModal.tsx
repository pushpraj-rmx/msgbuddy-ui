"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import type { EnablePushResult } from "@/hooks/use-push-subscription";
import { getApiError } from "@/lib/api-error";

/**
 * Browser push settings, surfaced from the notification bell (not a settings
 * page). Shows the current browser permission state (Allowed / Blocked / Not
 * requested) and a per-browser opt-in toggle. Turning it on triggers the
 * browser's native permission prompt when permission hasn't been granted yet.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  permission: NotificationPermission;
  enabled: boolean;
  enable: () => Promise<EnablePushResult>;
  disable: () => Promise<void>;
};

export function NotificationSettingsModal({
  open,
  onClose,
  permission,
  enabled,
  enable,
  disable,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener("close", handler);
    return () => el.removeEventListener("close", handler);
  }, [onClose]);

  const denied = permission === "denied";
  const status =
    permission === "granted"
      ? { label: "Allowed", cls: "badge-success" }
      : permission === "denied"
        ? { label: "Blocked", cls: "badge-error" }
        : { label: "Not requested", cls: "badge-ghost" };

  const onToggle = async () => {
    setError(null);
    setBusy(true);
    try {
      if (enabled) {
        await disable();
      } else {
        // enable() requests browser permission first (native prompt when the
        // permission is still "default"), then subscribes.
        const result = await enable();
        if (result === "denied") {
          setError(
            "Your browser blocked notifications. Allow them in your browser's site settings, then try again.",
          );
        } else if (result === "unsupported") {
          setError("This browser doesn't support push notifications.");
        } else if (result === "default") {
          setError("Permission wasn't granted. Turn it on again and choose Allow when your browser asks.");
        }
      }
    } catch (err: unknown) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="modal modal-middle">
      <div className="modal-box max-w-sm">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-base-content/60" />
          <h3 className="text-[1.0625rem] font-semibold tracking-[-0.015em]">
            Notifications
          </h3>
        </div>

        <div className="mt-4 rounded-box border border-base-300 bg-base-200">
          <div className="flex items-center justify-between gap-4 p-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[0.8125rem] font-semibold">Browser push</span>
                <span className={`badge badge-sm ${status.cls}`}>{status.label}</span>
              </div>
              <p className="mt-0.5 text-[0.71875rem] text-base-content/55">
                Alerts for new messages even when this tab is closed. Off by
                default — applies to this browser only.
              </p>
            </div>
            <input
              type="checkbox"
              role="switch"
              className="toggle toggle-primary shrink-0"
              checked={enabled}
              disabled={busy || denied}
              onChange={onToggle}
              aria-label="Enable browser push notifications"
            />
          </div>

          {denied ? (
            <div className="border-t border-base-300 px-3.5 py-2.5 text-[0.75rem] text-warning">
              Notifications are blocked in your browser. Open this site&apos;s
              settings in your browser and allow notifications, then reopen this
              dialog.
            </div>
          ) : !enabled ? (
            <div className="border-t border-base-300 px-3.5 py-2.5 text-[0.75rem] text-base-content/55">
              When you turn this on, your browser will ask for permission —
              choose Allow.
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="border-t border-base-300 px-3.5 py-2.5">
              <span className="op-label mb-1 block text-error">error</span>
              <span className="text-[0.8125rem] text-base-content">{error}</span>
            </div>
          ) : null}
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" className="sr-only" aria-label="Close">
          close
        </button>
      </form>
    </dialog>
  );
}
