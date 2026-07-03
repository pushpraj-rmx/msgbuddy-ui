"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { UploadCloud, Wand2 } from "lucide-react";
import {
  recurringApi,
  type StorefrontBranding,
  type ThemePreset,
} from "@/lib/recurringApi";
import { mediaApi } from "@/lib/api";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";

const PRESETS: { id: ThemePreset; label: string }[] = [
  { id: "WARM", label: "Warm" },
  { id: "MINIMAL", label: "Minimal" },
  { id: "BOLD", label: "Bold" },
];

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

/** WCAG-ish on-accent text color for the preview chip. */
function onAccent(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.4 ? "#1a1a1a" : "#ffffff";
}

/** Best-effort brand accent from a logo. node-vibrant (v4) runs a Web Worker that
 *  can hang in a bundled app, so we race it against a hard 6s timeout — it can
 *  never block or break the upload; the user can always pick a color manually. */
async function extractAccent(file: File): Promise<string | null> {
  const objUrl = URL.createObjectURL(file);
  try {
    const run = (async () => {
      const { Vibrant } = await import("node-vibrant/browser");
      const p = await Vibrant.from(objUrl).getPalette();
      return (
        p.Vibrant?.hex ?? p.DarkVibrant?.hex ?? p.LightVibrant?.hex ?? p.Muted?.hex ?? null
      );
    })();
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 6000));
    return await Promise.race([run, timeout]);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

/**
 * White-label storefront branding editor. Upload a logo → the accent color is
 * auto-extracted client-side (node-vibrant) and can be overridden; pick a preset,
 * set name/tagline; live preview. Persists to the branding API; the storefront
 * app renders from it.
 */
export function BrandingPanel() {
  const [b, setB] = useState<StorefrontBranding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setB(await recurringApi.getBranding());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof StorefrontBranding>(k: K, v: StorefrontBranding[K]) {
    setB((prev) => (prev ? { ...prev, [k]: v } : prev));
    setSaved(false);
  }

  async function onPickLogo(file: File) {
    setUploading(true);
    setError(null);
    setSaved(false);
    try {
      // 1) Upload FIRST — the logo must save regardless of colour extraction.
      const res = (await mediaApi.upload(file)) as { id: string; url: string };
      setB((prev) => (prev ? { ...prev, logoMediaId: res.id, logoUrl: res.url } : prev));

      // 2) Auto-extract the accent — best-effort, fire-and-forget, hard-timed-out
      //    so node-vibrant (Web Worker) can never hang or break the upload.
      void extractAccent(file)
        .then((hex) => hex && set("accentColor", hex))
        .catch(() => {});
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!b) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await recurringApi.updateBranding({
        displayName: b.displayName,
        tagline: b.tagline ?? "",
        logoMediaId: b.logoMediaId ?? "",
        accentColor: b.accentColor ?? undefined,
        themePreset: b.themePreset,
      });
      setB(updated);
      setSaved(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (!b) {
    return (
      <div className="rounded-box border border-base-300 p-4">
        {error ? (
          <span className="text-sm text-error">{error}</span>
        ) : (
          <span className="loading loading-spinner loading-sm" />
        )}
      </div>
    );
  }

  const accent = b.accentColor || "#6EA8FE";
  const logoSrc = resolveMediaUrlForUi(b.logoUrl); // relative /v2/media → absolute API URL

  return (
    <div className="space-y-4 rounded-box border border-base-300 p-4">
      <div className="op-label">Storefront branding</div>
      {error && (
        <div role="alert" className="rounded-box border border-error/30 bg-base-200 px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Left: controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed media URL preview
              <img src={logoSrc} alt="logo" className="h-14 w-14 rounded-box border border-base-300 object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-box border border-dashed border-base-300 text-base-content/40">
                <UploadCloud className="h-5 w-5" />
              </div>
            )}
            <div>
              <button
                className="btn btn-sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading && <span className="loading loading-spinner loading-xs" />}
                {b.logoUrl ? "Replace logo" : "Upload logo"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPickLogo(f);
                  e.target.value = "";
                }}
              />
              <p className="mt-1 flex items-center gap-1 text-[11px] text-base-content/50">
                <Wand2 className="h-3 w-3" /> accent auto-picked from the logo
              </p>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-xs text-base-content/60">
            Business name
            <input
              className="input input-bordered input-sm w-full"
              value={b.displayName}
              onChange={(e) => set("displayName", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-base-content/60">
            Tagline
            <input
              className="input input-bordered input-sm w-full"
              placeholder="Fresh, delivered on your schedule."
              value={b.tagline ?? ""}
              onChange={(e) => set("tagline", e.target.value)}
            />
          </label>

          <div className="flex items-center gap-3">
            <label className="flex flex-col gap-1 text-xs text-base-content/60">
              Accent
              <input
                type="color"
                className="h-9 w-16 rounded border border-base-300 bg-base-100"
                value={accent}
                onChange={(e) => set("accentColor", e.target.value)}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-base-content/60">
              Theme preset
              <select
                className="select select-bordered select-sm w-full"
                value={b.themePreset}
                onChange={(e) => set("themePreset", e.target.value as ThemePreset)}
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Right: live preview */}
        <div>
          <div className="op-label mb-1">Preview</div>
          <div className="overflow-hidden rounded-2xl border border-base-300">
            <div
              className="flex items-center gap-3 p-4"
              style={{ background: `color-mix(in oklab, ${accent} 16%, var(--color-base-200))` }}
            >
              {logoSrc ? (
                <Image
                  src={logoSrc}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-xl border border-base-300 object-cover"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold"
                  style={{ background: accent, color: onAccent(accent) }}
                >
                  {b.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-serif text-lg leading-tight">{b.displayName || "Your shop"}</div>
                {b.tagline && <div className="truncate text-xs text-base-content/60">{b.tagline}</div>}
              </div>
            </div>
            <div className="space-y-2 p-4">
              <div className="h-2 w-2/3 rounded bg-base-300" />
              <div className="h-2 w-1/2 rounded bg-base-300" />
              <button
                className="mt-1 rounded-lg px-3 py-1.5 text-sm font-medium"
                style={{ background: accent, color: onAccent(accent) }}
                type="button"
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}>
          {busy && <span className="loading loading-spinner loading-xs" />}
          Save branding
        </button>
        {saved && <span className="text-sm text-success">Saved.</span>}
      </div>
    </div>
  );
}
