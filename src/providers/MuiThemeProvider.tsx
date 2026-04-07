"use client";

import { ThemeProvider } from "@mui/material/styles";
import {
  type ReactNode,
  useMemo,
  useSyncExternalStore,
} from "react";
import { createStitchMuiTheme } from "@/theme/stitchMuiTheme";

function subscribeTheme(callback: () => void) {
  const el = document.documentElement;
  const obs = new MutationObserver(callback);
  obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

function getSnapshotTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function getServerSnapshotTheme(): "light" | "dark" {
  return "dark";
}

export function MuiThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const mode = useSyncExternalStore(
    subscribeTheme,
    getSnapshotTheme,
    getServerSnapshotTheme
  );

  const theme = useMemo(() => createStitchMuiTheme(mode), [mode]);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
