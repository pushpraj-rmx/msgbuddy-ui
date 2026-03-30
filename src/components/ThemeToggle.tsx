"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/react/24/outline";

const STORAGE_KEY = "theme-preference";
type ThemePreference = "system" | "dark" | "light";

function getStored(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "dark" || v === "light" || v === "system") return v;
  return "system";
}

function applyTheme(preference: ThemePreference) {
  const resolved = preference === "system"
    ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolved);
  }
}

const ORDER: ThemePreference[] = ["system", "dark", "light"];

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = getStored();
    setPreference(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(preference);
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mounted, preference]);

  const cycle = useCallback(() => {
    const idx = ORDER.indexOf(preference);
    const next = ORDER[(idx + 1) % ORDER.length];
    setPreference(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, [preference]);

  const displayPreference: ThemePreference = mounted ? preference : "system";
  const label =
    displayPreference === "system"
      ? "System"
      : displayPreference === "dark"
        ? "Dark"
        : "Light";

  return (
    <button
      type="button"
      onClick={cycle}
      className="btn btn-ghost btn-square"
      aria-label={`Theme: ${label}. Click to switch.`}
      title={`Theme: ${label}`}
    >
      {displayPreference === "system" && <ComputerDesktopIcon className="h-5 w-5" />}
      {displayPreference === "light" && <SunIcon className="h-5 w-5" />}
      {displayPreference === "dark" && <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
