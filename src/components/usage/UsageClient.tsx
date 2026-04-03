"use client";

import { useEffect, useState } from "react";
import { usageApi } from "@/lib/api";

function getErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || "Failed to load usage.";
}

export function UsageClient() {
  const [current, setCurrent] = useState<Record<string, unknown> | null>(null);
  const [limits, setLimits] = useState<Record<string, unknown> | null>(null);
  const [period, setPeriod] = useState<Record<string, unknown> | null>(null);
  const [storage, setStorage] = useState<Record<string, unknown> | null>(null);
  const [checkMessages, setCheckMessages] = useState<Record<string, unknown> | null>(
    null
  );
  const [checkContacts, setCheckContacts] = useState<Record<string, unknown> | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cur, lim, st, msgCheck, contactCheck, periodData] = await Promise.all([
        usageApi.current(),
        usageApi.limits(),
        usageApi.storage(),
        usageApi.checkMessages(1),
        usageApi.checkContacts(1),
        usageApi.period({
          start: start || undefined,
          end: end || undefined,
        }),
      ]);
      setCurrent((cur ?? null) as Record<string, unknown> | null);
      setLimits((lim ?? null) as Record<string, unknown> | null);
      setStorage((st ?? null) as Record<string, unknown> | null);
      setCheckMessages((msgCheck ?? null) as Record<string, unknown> | null);
      setCheckContacts((contactCheck ?? null) as Record<string, unknown> | null);
      setPeriod((periodData ?? null) as Record<string, unknown> | null);
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rebuild = async () => {
    setLoading(true);
    setError(null);
    try {
      await usageApi.rebuild();
      await load();
    } catch (err: unknown) {
      setError(getErr(err));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="form-control">
            <span className="label-text text-xs">Period start</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Period end</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => void rebuild()} disabled={loading}>
            Rebuild aggregates
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <JsonCard title="Current usage" data={current} />
        <JsonCard title="Limits" data={limits} />
        <JsonCard title="Period usage" data={period} />
        <JsonCard title="Storage usage" data={storage} />
        <JsonCard title="Message limit check" data={checkMessages} />
        <JsonCard title="Contact limit check" data={checkContacts} />
      </div>
    </div>
  );
}

function JsonCard({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base">{title}</h2>
        <pre className="max-h-64 overflow-auto rounded-box border border-base-300 bg-base-100 p-3 text-xs">
          {data == null ? "—" : JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

