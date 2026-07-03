"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { channelTemplatesApi, templatesApi } from "@/lib/api";
import type { ChannelTemplate } from "@/lib/types";
import { API_BASE_URL, endpoints } from "@/lib/endpoints";
import {
  recurringApi,
  type DeliveryWindow,
  type RazorpayStatus,
  type RecurringSettings,
} from "@/lib/recurringApi";

export interface AuthTemplateOption {
  versionId: string;
  label: string;
}

/**
 * Load approved WhatsApp AUTHENTICATION templates as selectable OTP options.
 * Mirrors the template→WA-channel→sendable-version resolution used elsewhere
 * (CreateCampaignForm): list sendable templates, then read each WA channel
 * template's state for its category + active/sendable version id.
 */
function useAuthTemplateOptions() {
  const [options, setOptions] = useState<AuthTemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await templatesApi.list({
          hasWhatsAppSendableVersion: true,
          isActive: true,
          limit: 100,
        });
        const candidates = res.items
          .map((t) => {
            const wa = (t.channelTemplates ?? []).find(
              (ct: ChannelTemplate) => ct.channel === "WHATSAPP" && !ct.deletedAt,
            );
            return wa ? { name: t.name, wa } : null;
          })
          .filter((x): x is { name: string; wa: ChannelTemplate } => !!x)
          // Keep AUTHENTICATION (or unknown category — confirmed via state below).
          .filter(({ wa }) => wa.category == null || wa.category === "AUTHENTICATION");

        const states = await Promise.all(
          candidates.map((c) =>
            channelTemplatesApi
              .state(c.wa.id)
              .then((s) => ({ c, s }))
              .catch(() => null),
          ),
        );

        const opts = states
          .flatMap((x) => (x ? [x] : []))
          .filter(({ s }) => s.category === "AUTHENTICATION")
          .flatMap(({ c, s }) => {
            const v = s.activeVersion ?? s.latestSendableVersion;
            return v ? [{ versionId: v.id, label: c.name }] : [];
          });

        if (!cancelled) setOptions(opts);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load templates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading, error };
}

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
  const { options: otpOptions, loading: otpLoading, error: otpError } = useAuthTemplateOptions();
  const currentOtpMissing =
    !!value.otpTemplateVersionId &&
    !otpLoading &&
    !otpOptions.some((o) => o.versionId === value.otpTemplateVersionId);
  // Prefer the dedicated storefront app (shop.msgbuddy.com/<handle>); fall back to
  // the in-app /s/<handle> route when the env isn't set.
  const storeBase = process.env.NEXT_PUBLIC_STOREFRONT_URL?.replace(/\/$/, "");
  const link = value.storefrontHandle
    ? storeBase
      ? `${storeBase}/${value.storefrontHandle}`
      : typeof window !== "undefined"
        ? `${window.location.origin}/s/${value.storefrontHandle}`
        : null
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
          OTP template (WhatsApp AUTHENTICATION)
          <select
            className="select select-bordered select-sm w-full"
            value={value.otpTemplateVersionId ?? ""}
            onChange={(e) => onPatch({ otpTemplateVersionId: e.target.value || null })}
          >
            <option value="">
              {otpLoading ? "Loading templates…" : "— Select a template —"}
            </option>
            {otpOptions.map((o) => (
              <option key={o.versionId} value={o.versionId}>
                {o.label}
              </option>
            ))}
            {/* Keep an already-saved value selectable even if it's since been archived. */}
            {currentOtpMissing && (
              <option value={value.otpTemplateVersionId ?? ""}>
                Current (unavailable — {value.otpTemplateVersionId?.slice(0, 8)}…)
              </option>
            )}
          </select>
          {!otpLoading && otpOptions.length === 0 && !otpError && (
            <span className="text-[11px] text-warning">
              No approved AUTHENTICATION templates.{" "}
              <Link href="/templates" className="link">
                Create one
              </Link>
              .
            </span>
          )}
          {otpError && <span className="text-[11px] text-error">{otpError}</span>}
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

/**
 * Per-merchant Razorpay connect (3B). Each merchant pastes their OWN Razorpay
 * keys so customer payments settle to their account. Secrets are write-only
 * (never returned). Shows the exact webhook URL to register in Razorpay.
 */
export function RazorpayConnectPanel() {
  const [status, setStatus] = useState<RazorpayStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ keyId: "", keySecret: "", webhookSecret: "" });

  const load = useCallback(async () => {
    try {
      setStatus(await recurringApi.razorpayStatus());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const webhookUrl =
    status?.workspaceId ? `${API_BASE_URL}${endpoints.recurring.razorpayWebhook(status.workspaceId)}` : "";

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await recurringApi.connectRazorpay(form));
      setForm({ keyId: "", keySecret: "", webhookSecret: "" });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect this Razorpay account? The storefront can't take payments until reconnected.")) return;
    setBusy(true);
    setError(null);
    try {
      setStatus(await recurringApi.disconnectRazorpay());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-box border border-base-300 p-4">
      <div className="flex items-center justify-between">
        <div className="op-label">Payments · Razorpay</div>
        {status && (
          <span className={`badge badge-sm ${status.connected ? "badge-success" : "badge-ghost"}`}>
            {status.connected ? "Connected" : "Not connected"}
          </span>
        )}
      </div>
      <p className="text-xs text-base-content/50">
        Connect the merchant&apos;s own Razorpay account — customer payments settle directly to them.
      </p>
      {error && (
        <div role="alert" className="rounded-box border border-error/30 bg-base-200 px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}

      {status?.connected ? (
        <div className="space-y-2 text-sm">
          <div>
            Key ID: <span className="font-mono-op">{status.keyId}</span>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-base-content/60">
              Register this webhook in Razorpay (events: <code>payment.captured</code>, <code>order.paid</code>):
            </div>
            <div className="break-all rounded bg-base-200 px-2 py-1 font-mono-op text-xs">{webhookUrl}</div>
            <button className="btn btn-xs" onClick={() => void navigator.clipboard?.writeText(webhookUrl)}>
              Copy webhook URL
            </button>
            {!status.webhookConfigured && (
              <span className="ml-2 text-[11px] text-warning">Webhook secret not set — reconnect to add it.</span>
            )}
          </div>
          <button className="btn btn-xs btn-ghost text-error" onClick={disconnect} disabled={busy}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className="input input-bordered input-sm"
            placeholder="Key ID (rzp_...)"
            value={form.keyId}
            onChange={(e) => setForm({ ...form, keyId: e.target.value })}
          />
          <input
            type="password"
            className="input input-bordered input-sm"
            placeholder="Key Secret"
            value={form.keySecret}
            onChange={(e) => setForm({ ...form, keySecret: e.target.value })}
          />
          <input
            type="password"
            className="input input-bordered input-sm"
            placeholder="Webhook Secret"
            value={form.webhookSecret}
            onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
          />
          <button
            className="btn btn-sm btn-primary sm:col-span-3"
            disabled={busy || !form.keyId || !form.keySecret || !form.webhookSecret}
            onClick={connect}
          >
            {busy && <span className="loading loading-spinner loading-xs" />}
            Connect Razorpay
          </button>
        </div>
      )}
    </div>
  );
}
