"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dispatchOpenGlobalSearch, dispatchOpenShortcutsHelp } from "@/lib/shortcuts";
import { useMediaQuery, XL_MEDIA_QUERY } from "@/hooks/useMediaQuery";
import { useRightPanel } from "@/components/right-panel/useRightPanel";

type Point = { x: number; y: number };

function isNativeContextTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || tag === "option")
    return true;
  if (el.isContentEditable) return true;
  if (el.closest("a[href]")) return true;
  if (el.closest("[data-allow-native-context-menu]")) return true;
  return false;
}

/**
 * App-wide custom context menu on primary right-click (non-form targets).
 * Extend menu items as needed.
 */
export function GlobalContextMenu() {
  const { isOpen: rightPanelOpen, close: closeRightPanel, open: openRightPanel } =
    useRightPanel();
  const isXlUp = useMediaQuery(XL_MEDIA_QUERY);
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPoint(null);
  }, []);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (e.button !== 2) return;
      if (isNativeContextTarget(e.target)) return;
      e.preventDefault();
      setPoint({ x: e.clientX, y: e.clientY });
      setOpen(true);
    };
    document.addEventListener("contextmenu", onContextMenu, true);
    return () => document.removeEventListener("contextmenu", onContextMenu, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close]);

  useEffect(() => {
    const onEscapePriority = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !open) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onEscapePriority, true);
    return () => window.removeEventListener("keydown", onEscapePriority, true);
  }, [open, close]);

  if (!open || !point) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const menuW = 220;
  const menuH = 200;
  const left = Math.min(point.x, vw - menuW - 8);
  const top = Math.min(point.y, vh - menuH - 8);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="App menu"
      className="fixed z-[60] min-w-[12rem] rounded-box border border-base-300 bg-base-100 p-1 shadow-xl"
      style={{ left, top }}
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center justify-between rounded-none px-3 py-2 text-left text-sm hover:bg-base-200"
        onClick={() => {
          dispatchOpenGlobalSearch();
          close();
        }}
      >
        <span>Global search</span>
        <kbd className="kbd kbd-sm">
          {typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
            ? "⌘K"
            : "Ctrl+K"}
        </kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center justify-between rounded-none px-3 py-2 text-left text-sm hover:bg-base-200"
        onClick={() => {
          dispatchOpenShortcutsHelp();
          close();
        }}
      >
        <span>Keyboard shortcuts</span>
        <kbd className="kbd kbd-sm">?</kbd>
      </button>
      {isXlUp ? (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center justify-between rounded-none px-3 py-2 text-left text-sm hover:bg-base-200"
          onClick={() => {
            if (rightPanelOpen) closeRightPanel();
            else openRightPanel();
            close();
          }}
        >
          <span>{rightPanelOpen ? "Close details pane" : "Open details pane"}</span>
        </button>
      ) : null}
      <div className="my-1 h-px bg-base-300" role="separator" />
      <div className="px-3 py-2 text-xs text-base-content/50">More actions later…</div>
    </div>
  );
}
