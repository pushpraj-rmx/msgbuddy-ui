"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  dispatchOpenGlobalSearch,
  SHORTCUT_EVENTS,
} from "@/lib/shortcuts";
import { GlobalContextMenu } from "./GlobalContextMenu";
import { KeyboardShortcutsHelpModal } from "./KeyboardShortcutsHelpModal";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

function isAnyModalDialogOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector("dialog:modal") !== null;
}

/**
 * Global keyboard shortcuts. Add new handlers here over time.
 */
export function AppShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpenRef = useRef(false);
  helpOpenRef.current = helpOpen;

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    const onOpenHelp = () => openHelp();
    window.addEventListener(SHORTCUT_EVENTS.OPEN_SHORTCUTS_HELP, onOpenHelp);
    return () =>
      window.removeEventListener(SHORTCUT_EVENTS.OPEN_SHORTCUTS_HELP, onOpenHelp);
  }, [openHelp]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatchOpenGlobalSearch();
        return;
      }

      const typing = isTypingTarget(e.target);

      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (typing) return;
        e.preventDefault();
        if (helpOpenRef.current) {
          setHelpOpen(false);
          return;
        }
        if (isAnyModalDialogOpen()) return;
        setHelpOpen(true);
        return;
      }

    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <KeyboardShortcutsHelpModal open={helpOpen} onClose={closeHelp} />
      <GlobalContextMenu />
    </>
  );
}
