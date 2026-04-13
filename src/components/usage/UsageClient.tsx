"use client";

import { useEffect, useState } from "react";
import { usageApi } from "@/lib/api";

function getErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || "Failed to load usage.";
}

type UsageSummary = {
  messagesSent: number;
  messagesReceived: number;
  contactsCreated: number;
  mediaUploaded: number;
  templatesSent: number;
  campaignMessages: number;
  totalMessages: number;
};

type LimitSlice = {
  current: number;
  limit: number;
  remaining: number;
  percentUsed: number;
};

type UsageWithLimitsResponse = {
  usage: UsageSummary;
  limits: {
    messages: LimitSlice;
    contacts: LimitSlice;
    agents: LimitSlice;
  };
};

type StorageUsageResponse = {
  usedBytes: number;
  limitBytes: number;
  usedPercent: number;
};

type LimitCheckResult = {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  remaining: number;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits = v >= 10 || i === 0 ? 0 : 1;
  return `${v.toFixed(digits)} ${units[i]}`;
}

function progressTone(percent: number): string {
  if (percent >= 100) return "progress-error";
  if (percent >= 90) return "progress-warning";
  return "progress-primary";
}

function QuotaBlock({
  title,
  slice,
  subtitle,
}: {
  title: string;
  slice: LimitSlice;
  subtitle?: string;
}) {
  const pct = Math.min(100, Math.max(0, slice.percentUsed));

  return (
    <div className="rounded-box border border-base-300 bg-base-200/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-base-content">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-base-content/60">{subtitle}</p>
          ) : null}
        </div>
        <span
          className={`badge badge-sm shrink-0 ${
            pct >= 100 ? "badge-error" : pct >= 90 ? "badge-warning" : "badge-ghost"
          }`}
        >
          {pct}%
        </span>
      </div>
      <p className="mt-3 tabular-nums text-2xl font-semibold tracking-tight text-base-content">
        {slice.current}
        <span className="text-base font-normal text-base-content/50"> / {slice.limit}</span>
      </p>
      <p className="text-xs text-base-content/60">
        {slice.remaining} remaining this period
      </p>
      <progress
        className={`progress mt-3 h-2 w-full ${progressTone(pct)}`}
        value={pct}
        max={100}
      />
    </div>
  );
}

function ActivityGrid({ usage, heading }: { usage: UsageSummary; heading: string }) {
  const rows: { label: string; value: number }[] = [
    { label: "Messages sent", value: usage.messagesSent },
    { label: "Messages received", value: usage.messagesReceived },
    { label: "Campaign messages", value: usage.campaignMessages },
    { label: "Contacts created", value: usage.contactsCreated },
    { label: "Media uploads", value: usage.mediaUploaded },
    { label: "Templates sent", value: usage.templatesSent },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-base-content/80">{heading}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100 px-3 py-2.5"
          >
            <span className="text-sm text-base-content/70">{row.label}</span>
            <span className="tabular-nums text-sm font-semibold text-base-content">
              {row.value}
            </span>
          </div>
        ))}
        <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-box border border-primary/30 bg-primary/5 px-3 py-2.5">
          <span className="text-sm font-medium text-base-content">Total outbound messages</span>
          <span className="tabular-nums text-sm font-semibold text-primary">
            {usage.totalMessages}
          </span>
        </div>
      </div>
    </div>
  );
}

export function UsageClient() {
  const [limitsData, setLimitsData] = useState<UsageWithLimitsResponse | null>(null);
  const [storageData, setStorageData] = useState<StorageUsageResponse | null>(null);
  const [msgCheck, setMsgCheck] = useState<LimitCheckResult | null>(null);
  const [contactCheck, setContactCheck] = useState<LimitCheckResult | null>(null);

  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customUsage, setCustomUsage] = useState<UsageSummary | null>(null);
  const [customLabel, setCustomLabel] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchMain(): Promise<void> {
    const [lim, st, mc, cc] = await Promise.all([
      usageApi.limits() as Promise<UsageWithLimitsResponse>,
      usageApi.storage() as Promise<StorageUsageResponse>,
      usageApi.checkMessages(1) as Promise<LimitCheckResult>,
      usageApi.checkContacts(1) as Promise<LimitCheckResult>,
    ]);
    setLimitsData(lim);
    setStorageData(st);
    setMsgCheck(mc);
    setContactCheck(cc);
  }

  async function fetchCustomRange(start: string, end: string): Promise<void> {
    const pu = await usageApi.period({ start, end });
    setCustomUsage(pu as UsageSummary);
    setCustomLabel(`${start} → ${end}`);
  }

  async function refreshAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await fetchMain();
      const cs = customStart.trim();
      const ce = customEnd.trim();
      if (cs && ce) {
        await fetchCustomRange(cs, ce);
      } else {
        setCustomUsage(null);
        setCustomLabel(null);
      }
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchMain();
      } catch (err: unknown) {
        setError(getErr(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const applyCustomRange = async () => {
    const cs = customStart.trim();
    const ce = customEnd.trim();
    if (!cs || !ce) {
      setError("Choose a start and end date to load a custom range.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fetchMain();
      await fetchCustomRange(cs, ce);
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  const clearCustomRange = async () => {
    setCustomStart("");
    setCustomEnd("");
    setCustomUsage(null);
    setCustomLabel(null);
    setLoading(true);
    setError(null);
    try {
      await fetchMain();
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  const rebuild = async () => {
    setLoading(true);
    setError(null);
    try {
      await usageApi.rebuild();
      await refreshAll();
    } catch (err: unknown) {
      setError(getErr(err));
      setLoading(false);
    }
  };

  const usage = limitsData?.usage;
  const lim = limitsData?.limits;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-base-content/70">
          Usage resets on your monthly billing cycle (calendar month).
        </p>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => void refreshAll()}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Refresh
            </>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error alert-soft">
          <span>{error}</span>
        </div>
      ) : null}

      {!limitsData && loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-lg loading-spinner text-primary" />
        </div>
      ) : null}

      {limitsData && lim && usage ? (
        <>
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
              Plan limits
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <QuotaBlock
                title="Messages"
                subtitle="Outbound + campaign sends this month"
                slice={lim.messages}
              />
              <QuotaBlock title="Contacts" slice={lim.contacts} />
              <QuotaBlock title="Team seats" slice={lim.agents} />
            </div>
          </section>

          <section className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-6">
            <ActivityGrid
              usage={usage}
              heading="This billing month — activity"
            />
          </section>
        </>
      ) : null}

      {storageData ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
            Media storage
          </h2>
          <div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="text-base font-medium">Workspace media</h3>
                <p className="mt-1 tabular-nums text-sm text-base-content/80">
                  <span className="font-semibold text-base-content">
                    {formatBytes(storageData.usedBytes)}
                  </span>
                  <span className="text-base-content/50"> of </span>
                  {formatBytes(storageData.limitBytes)}
                  <span className="text-base-content/50"> used</span>
                </p>
              </div>
              <span
                className={`badge ${
                  storageData.usedPercent >= 95
                    ? "badge-warning"
                    : "badge-ghost"
                }`}
              >
                {storageData.usedPercent}%
              </span>
            </div>
            <progress
              className={`progress mt-4 h-3 w-full ${progressTone(storageData.usedPercent)}`}
              value={Math.min(100, storageData.usedPercent)}
              max={100}
            />
          </div>
        </section>
      ) : null}

      {(msgCheck || contactCheck) && limitsData ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
            Next actions
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {msgCheck ? (
              <div
                className={`rounded-box border px-4 py-3 text-sm ${
                  msgCheck.allowed
                    ? "border-success/30 bg-success/5"
                    : "border-error/30 bg-error/5"
                }`}
              >
                <p className="font-medium text-base-content">
                  {msgCheck.allowed ? "Send another message" : "Message limit"}
                </p>
                <p className="mt-1 text-base-content/70">
                  {msgCheck.allowed
                    ? `${msgCheck.remaining} sends left this period.`
                    : (msgCheck.reason ?? "Limit reached.")}
                </p>
              </div>
            ) : null}
            {contactCheck ? (
              <div
                className={`rounded-box border px-4 py-3 text-sm ${
                  contactCheck.allowed
                    ? "border-success/30 bg-success/5"
                    : "border-error/30 bg-error/5"
                }`}
              >
                <p className="font-medium text-base-content">
                  {contactCheck.allowed ? "Add another contact" : "Contact limit"}
                </p>
                <p className="mt-1 text-base-content/70">
                  {contactCheck.allowed
                    ? `${contactCheck.remaining} slots left.`
                    : (contactCheck.reason ?? "Limit reached.")}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
          Custom date range
        </h2>
        <div className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-6">
          <p className="text-sm text-base-content/70">
            Compare usage for any date range (does not change plan limits above).
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="form-control">
              <span className="label-text text-xs">Start</span>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs">End</span>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void applyCustomRange()}
              disabled={loading}
            >
              Apply range
            </button>
            {customUsage ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void clearCustomRange()}
                disabled={loading}
              >
                Clear range
              </button>
            ) : null}
          </div>
          {customUsage && customLabel ? (
            <div className="mt-6 border-t border-base-300 pt-6">
              <ActivityGrid
                usage={customUsage}
                heading={`Custom range (${customLabel})`}
              />
            </div>
          ) : null}
        </div>
      </section>

      <details className="rounded-box border border-base-300 bg-base-200/20">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-base-content/80">
          Advanced
        </summary>
        <div className="border-t border-base-300 px-4 pb-4 pt-3">
          <p className="text-sm text-base-content/70">
            Rebuild usage aggregates from raw events if counts look wrong (admin).
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm btn-error mt-3"
            onClick={() => void rebuild()}
            disabled={loading}
          >
            Rebuild aggregates
          </button>
        </div>
      </details>
    </div>
  );
}
