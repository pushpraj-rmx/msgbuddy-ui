"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { DEFAULT_THEME, THEMES, getTheme, isValidTheme } from "@/lib/themes";

const STORAGE_KEY = "theme-preference";

function getStored(): string {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const v = localStorage.getItem(STORAGE_KEY);
  return isValidTheme(v) ? v : DEFAULT_THEME;
}

function applyTheme(id: string) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", id);
  }
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<string>(DEFAULT_THEME);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = getStored();
    /* eslint-disable react-hooks/set-state-in-effect -- SSR hydration guard: reads localStorage + prevents FOUC */
    setTheme(stored);
    applyTheme(stored);
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = useCallback((id: string) => {
    setTheme(id);
    localStorage.setItem(STORAGE_KEY, id);
    applyTheme(id);
    setOpen(false);
  }, []);

  const current = getTheme(mounted ? theme : DEFAULT_THEME);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-ghost btn-square"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}. Click to change.`}
        title={`Theme: ${current.label}`}
      >
        <Palette className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-44 rounded-box border border-base-300 bg-base-200 p-1.5 shadow-lg"
          style={{ animation: "op-panel-fade-in 0.12s ease-out" }}
        >
          <div className="op-label px-2 py-1">Theme</div>
          {THEMES.map((t) => {
            const active = t.id === current.id;
            return (
              <button
                key={t.id}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => pick(t.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  active ? "bg-base-300 font-medium" : "hover:bg-base-300/60"
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-base-content/15"
                  style={{ background: t.swatch }}
                />
                <span className="flex-1 text-left">{t.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
