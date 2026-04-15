"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "theme-preference";
type ThemePreference = "dark" | "light";

function getStored(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "dark" || v === "light") return v;
  return "dark";
}

function applyTheme(preference: ThemePreference) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", preference);
  }
}

const ORDER: ThemePreference[] = ["dark", "light"];

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [preference, setPreference] = useState<ThemePreference>("dark");

  useEffect(() => {
    const stored = getStored();
    setPreference(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(preference);
  }, [mounted, preference]);

  const cycle = useCallback(() => {
    const idx = ORDER.indexOf(preference);
    const next = ORDER[(idx + 1) % ORDER.length];
    setPreference(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, [preference]);

  const displayPreference: ThemePreference = mounted ? preference : "dark";
  const label =
    displayPreference === "dark" ? "Dark" : "Light";

  return (
    <button
      type="button"
      onClick={cycle}
      className="btn btn-ghost btn-square"
      aria-label={`Theme: ${label}. Click to switch.`}
      title={`Theme: ${label}`}
    >
      {displayPreference === "light" && <Sun className="h-5 w-5" />}
      {displayPreference === "dark" && <Moon className="h-5 w-5" />}
    </button>
  );
}
