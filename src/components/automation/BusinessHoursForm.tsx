"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiError } from "@/lib/api-error";
import {
  automationApi,
  type BusinessHoursConfig,
  type BusinessHoursDay,
  type BusinessHoursEntry,
} from "@/lib/api";

/**
 * Inline schedule editor for the workspace's business hours. Seven rows, one
 * per day, with open/closed toggle + start/end time. Strict HH:mm; backend
 * also validates the shape (overnight ranges intentionally not supported in
 * this phase).
 */

const DAYS: { key: BusinessHoursDay; label: string }[] = [
  { key: "MON", label: "Monday" },
  { key: "TUE", label: "Tuesday" },
  { key: "WED", label: "Wednesday" },
  { key: "THU", label: "Thursday" },
  { key: "FRI", label: "Friday" },
  { key: "SAT", label: "Saturday" },
  { key: "SUN", label: "Sunday" },
];

type DayState = {
  open: boolean;
  start: string;
  end: string;
};

function hydrate(schedule: BusinessHoursEntry[]): Record<BusinessHoursDay, DayState> {
  const out = {} as Record<BusinessHoursDay, DayState>;
  for (const { key } of DAYS) {
    const found = schedule.find((s) => s.day === key);
    out[key] = found
      ? { open: true, start: found.start, end: found.end }
      : { open: false, start: "09:00", end: "18:00" };
  }
  return out;
}

export function BusinessHoursForm({ initial }: { initial: BusinessHoursConfig }) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(initial.isActive);
  const [days, setDays] = useState<Record<BusinessHoursDay, DayState>>(
    hydrate(initial.schedule),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const update = (
    key: BusinessHoursDay,
    patch: Partial<DayState>,
  ) => {
    setDays((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const schedule: BusinessHoursEntry[] = DAYS.filter(
        ({ key }) => days[key].open,
      ).map(({ key }) => ({
        day: key,
        start: days[key].start,
        end: days[key].end,
      }));
      await automationApi.updateBusinessHours({ isActive, schedule });
      setSavedAt(new Date());
      router.refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to save business hours.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="card bg-base-100 border border-base-300 p-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <div>
            <p className="text-sm font-medium">
              Business hours active
            </p>
            <p className="text-xs text-base-content/65">
              When off, OUT_OF_HOURS automation rules never fire regardless of
              schedule. Timezone: <span className="font-mono-op">{initial.timezone}</span>
            </p>
          </div>
        </label>
      </div>

      <div className="card bg-base-100 border border-base-300 p-4">
        <p className="op-label mb-3">Weekly schedule</p>
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const d = days[key];
            return (
              <div
                key={key}
                className="grid grid-cols-[120px_80px_1fr_1fr] items-center gap-2 sm:gap-3"
              >
                <span className="text-sm">{label}</span>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={d.open}
                    onChange={(e) =>
                      update(key, { open: e.target.checked })
                    }
                  />
                  Open
                </label>
                <input
                  type="time"
                  className="input input-bordered input-sm"
                  value={d.start}
                  onChange={(e) => update(key, { start: e.target.value })}
                  disabled={!d.open}
                />
                <input
                  type="time"
                  className="input input-bordered input-sm"
                  value={d.end}
                  onChange={(e) => update(key, { end: e.target.value })}
                  disabled={!d.open}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </button>
        {savedAt ? (
          <span className="text-xs text-base-content/55">
            Saved · {savedAt.toLocaleTimeString()}
          </span>
        ) : null}
      </div>
    </div>
  );
}
