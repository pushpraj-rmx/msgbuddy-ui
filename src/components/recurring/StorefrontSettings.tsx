"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  recurringApi,
  type DeliveryWindow,
  type RecurringSettings,
} from "@/lib/recurringApi";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

/**
 * Storefront (2A) fields on the Settings tab: public handle, enable toggle, OTP
 * template, and — once enabled — the shareable link + a printable QR code. These
 * values live on RecurringSettings, so they persist with the tab's main Save.
 */
export function StorefrontFields({
  value,
  onPatch,
}: {
  value: RecurringSettings;
  onPatch: (patch: Partial<RecurringSettings>) => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const link =
    value.storefrontHandle && typeof window !== "undefined"
      ? `${window.location.origin}/s/${value.storefrontHandle}`
      : null;

  useEffect(() => {
    let cancelled = false;
    if (value.storefrontEnabled && link) {
      QRCode.toDataURL(link, { width: 320, margin: 2 })
        .then((d) => !cancelled && setQr(d))
        .catch(() => !cancelled && setQr(null));
    }
    // When disabled / no link the QR simply isn't rendered (see guard below), so
    // there's no need to synchronously clear it here.
    return () => {
      cancelled = true;
    };
  }, [link, value.storefrontEnabled]);

  return (
    <div className="space-y-3 rounded-box border border-base-300 p-4">
      <div className="op-label">Customer storefront</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-base-content/60">
          Storefront handle
          <input
            className="input input-bordered input-sm w-full"
            placeholder="sunrise-bakery"
            value={value.storefrontHandle ?? ""}
            onChange={(e) =>
              onPatch({ storefrontHandle: e.target.value.trim().toLowerCase() || null })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-base-content/60">
          OTP template id (WhatsApp AUTHENTICATION)
          <input
            className="input input-bordered input-sm w-full"
            value={value.otpTemplateVersionId ?? ""}
            onChange={(e) => onPatch({ otpTemplateVersionId: e.target.value || null })}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={value.storefrontEnabled}
          onChange={(e) => onPatch({ storefrontEnabled: e.target.checked })}
        />
        Enable the public storefront
      </label>

      {value.storefrontEnabled && link && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL QR, not a remote asset
            <img
              src={qr}
              alt="Storefront QR code"
              className="h-32 w-32 rounded-box bg-white p-1"
            />
          )}
          <div className="space-y-2">
            <div className="break-all rounded bg-base-200 px-2 py-1 font-mono-op text-xs">
              {link}
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-xs"
                onClick={() => void navigator.clipboard?.writeText(link)}
              >
                Copy link
              </button>
              {qr && (
                <a className="btn btn-xs" href={qr} download={`${value.storefrontHandle}-qr.png`}>
                  Download QR
                </a>
              )}
            </div>
            <p className="text-xs text-base-content/50">
              Save settings first, then share this link or print the QR for customers to subscribe.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Delivery windows (4A) — self-contained CRUD. A window = an open delivery slot
 * on a weekday; the set of weekdays with an active window is the merchant's open
 * days, which cycle generation enforces.
 */
export function DeliveryWindowsPanel() {
  const [windows, setWindows] = useState<DeliveryWindow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ weekday: 1, startTime: "08:00", endTime: "12:00", label: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWindows(await recurringApi.listDeliveryWindows());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="space-y-3 rounded-box border border-base-300 p-4">
      <div className="op-label">Delivery windows</div>
      <p className="text-xs text-base-content/50">
        Deliveries only happen on weekdays with an active window. Leave empty to allow every day.
      </p>
      {error && (
        <div role="alert" className="rounded-box border border-error/30 bg-base-200 px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}

      {loading ? (
        <span className="loading loading-spinner loading-sm" />
      ) : (
        <div className="space-y-1">
          {windows.length === 0 && (
            <p className="text-sm text-base-content/50">No windows yet — open every day.</p>
          )}
          {windows.map((w) => (
            <div
              key={w.id}
              className={`flex items-center gap-3 rounded-box border border-base-300 px-3 py-2 text-sm ${
                w.active ? "" : "opacity-50"
              }`}
            >
              <span className="w-10 font-medium">{WEEKDAYS[w.weekday]}</span>
              <span className="font-mono-op tabular-nums">
                {w.startTime}–{w.endTime}
              </span>
              {w.label && <span className="text-base-content/50">{w.label}</span>}
              <span className="ml-auto flex gap-2">
                <button
                  className="btn btn-xs"
                  onClick={() => void act(() => recurringApi.updateDeliveryWindow(w.id, { active: !w.active }))}
                >
                  {w.active ? "Disable" : "Enable"}
                </button>
                <button
                  className="btn btn-xs btn-ghost text-error"
                  onClick={() => void act(() => recurringApi.deleteDeliveryWindow(w.id))}
                >
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-base-300 pt-3">
        <label className="flex flex-col gap-1 text-xs text-base-content/60">
          Day
          <select
            className="select select-bordered select-sm"
            value={draft.weekday}
            onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}
          >
            {WEEKDAYS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-base-content/60">
          From
          <input
            type="time"
            className="input input-bordered input-sm"
            value={draft.startTime}
            onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-base-content/60">
          To
          <input
            type="time"
            className="input input-bordered input-sm"
            value={draft.endTime}
            onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-base-content/60">
          Label (optional)
          <input
            className="input input-bordered input-sm w-28"
            placeholder="Morning"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </label>
        <button
          className="btn btn-sm btn-primary"
          onClick={() =>
            void act(() =>
              recurringApi.createDeliveryWindow({
                weekday: draft.weekday,
                startTime: draft.startTime,
                endTime: draft.endTime,
                label: draft.label || undefined,
              }),
            )
          }
        >
          Add window
        </button>
      </div>
    </div>
  );
}
