"use client";

import { useState } from "react";
import { Type } from "lucide-react";
import { meApi, type DisplayDensity } from "@/lib/api";
import { getApiError } from "@/lib/api-error";

const DENSITY_KEY = "display-density";

const OPTIONS: Array<{
  value: DisplayDensity;
  label: string;
  hint: string;
  px: number;
}> = [
  { value: "SMALL", label: "Compact", hint: "Smaller text, more rows on screen.", px: 14 },
  { value: "MEDIUM", label: "Default", hint: "Balanced for most screens.", px: 16 },
  { value: "LARGE", label: "Comfortable", hint: "Bigger text, easier to read.", px: 18 },
];

function applyDensity(density: DisplayDensity) {
  if (typeof document === "undefined") return;
  const value = density.toLowerCase();
  document.documentElement.setAttribute("data-density", value);
  try {
    localStorage.setItem(DENSITY_KEY, value);
  } catch {
    // ignore
  }
}

export function DisplayPreferencesClient({
  initialDensity,
}: {
  initialDensity: DisplayDensity;
}) {
  const [density, setDensity] = useState<DisplayDensity>(initialDensity);
  const [saving, setSaving] = useState<DisplayDensity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (next: DisplayDensity) => {
    if (next === density) return;
    const previous = density;
    setError(null);
    setSaving(next);
    setDensity(next);
    applyDensity(next); // optimistic
    try {
      await meApi.updatePreferences({ displayDensity: next });
    } catch (err: unknown) {
      // Revert
      setDensity(previous);
      applyDensity(previous);
      setError(getApiError(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-box border border-base-300 bg-base-200">
      <div className="flex items-baseline gap-3 border-b border-base-300 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Type className="h-3.5 w-3.5 text-base-content/55" />
          <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Text size</h3>
        </div>
        <span className="op-label">scales the entire UI</span>
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-3 sm:p-5">
        {OPTIONS.map((opt) => {
          const active = density === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPick(opt.value)}
              disabled={saving !== null}
              aria-pressed={active}
              className={`group flex flex-col items-start gap-1.5 rounded-box border px-3 py-3 text-left transition-colors disabled:cursor-progress ${
                active
                  ? "border-primary bg-primary/5"
                  : "border-base-300 bg-base-100 hover:border-base-content/30"
              }`}
            >
              <div className="flex w-full items-baseline justify-between">
                <span className={`text-[0.8125rem] font-semibold ${active ? "text-primary" : ""}`}>
                  {opt.label}
                </span>
                <span className="font-mono-op text-[0.625rem] tabular-nums text-base-content/45">
                  {opt.px}px
                </span>
              </div>
              <span className="text-[0.71875rem] text-base-content/55">{opt.hint}</span>
              {saving === opt.value ? (
                <span className="loading loading-spinner loading-xs mt-1" />
              ) : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <div role="alert" className="border-t border-base-300 px-4 py-2.5 sm:px-5">
          <span className="op-label mb-1 block text-error">error</span>
          <span className="text-[0.8125rem] text-base-content">{error}</span>
        </div>
      ) : null}
    </div>
  );
}
