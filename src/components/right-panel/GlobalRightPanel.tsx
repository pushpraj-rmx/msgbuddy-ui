"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useMediaQuery, LG_MEDIA_QUERY } from "@/hooks/useMediaQuery";
import { useRightPanel } from "./useRightPanel";

const PANEL_WIDTH_KEY = "global-details-pane-width";
const DEFAULT_WIDTH = 420; // px — roughly 28vw at 1500px
const MIN_WIDTH = 280;
const MAX_WIDTH_RATIO = 0.5; // max 50vw

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(PANEL_WIDTH_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= MIN_WIDTH) return n;
    }
  } catch { /* ignore */ }
  return DEFAULT_WIDTH;
}

function persistWidth(w: number) {
  try { localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(w))); } catch { /* ignore */ }
}

/**
 * Details pane:
 * - Desktop (lg+): inline resizable panel beside main content
 * - Mobile: full-screen overlay sliding in from right with back button
 *
 * Features:
 * - Empty state when no content is selected (desktop only)
 * - Fade-in animation when content changes
 * - Tabs support (rendered below header if panel.tabs is provided)
 * - Drag-to-resize handle on left edge (desktop only)
 * - Keyboard shortcut: `.` toggles panel
 */
export function GlobalRightPanel() {
  // Visibility is content-driven: the panel shows whenever a page provides
  // content and hides when the page clears it. It is intentionally NOT
  // collapsible — no Esc/shortcut/toggle to dismiss it (agents rely on it).
  // `isOpen`/`close` are retained only for the mobile dismissable overlay.
  const { isOpen, close, panel, activeTab, setActiveTab } = useRightPanel();
  const isLgUp = useMediaQuery(LG_MEDIA_QUERY);

  // Resize state (desktop only)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Restore width from localStorage on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration guard: localStorage unavailable during SSR
    setPanelWidth(readStoredWidth());
  }, []);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [panelWidth]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const maxW = window.innerWidth * MAX_WIDTH_RATIO;
    const delta = dragStartX.current - e.clientX; // dragging left = wider
    const next = Math.min(maxW, Math.max(MIN_WIDTH, dragStartWidth.current + delta));
    setPanelWidth(next);
  }, []);

  const onDragEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    setPanelWidth((w) => { persistWidth(w); return w; });
  }, []);

  // Double-click handle resets to default
  const onDoubleClick = useCallback(() => {
    setPanelWidth(DEFAULT_WIDTH);
    persistWidth(DEFAULT_WIDTH);
  }, []);

  const detailsContent = panel?.content;
  const tabs = panel?.tabs;
  const hasDetails = Boolean(detailsContent) || Boolean(tabs?.length);

  // Resolve which content to render: tabs content (by active key) or flat content
  const renderedContent = useMemo(() => {
    if (tabs?.length) {
      const match = tabs.find((t) => t.key === activeTab) ?? tabs[0];
      return match?.content ?? null;
    }
    return detailsContent ?? null;
  }, [tabs, activeTab, detailsContent]);

  // Key for fade animation — changes when source or title changes
  const contentKey = `${panel?.source ?? ""}-${panel?.title ?? ""}`;

  // Lock body scroll when mobile overlay is open
  useEffect(() => {
    if (!isOpen || !hasDetails || isLgUp) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen, hasDetails, isLgUp]);

  // ── Tabs bar (shared between desktop + mobile) ──
  const tabsBar = tabs?.length ? (
    <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-base-300 px-4">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`relative whitespace-nowrap px-3 py-2 font-mono-op text-[0.625rem] tracking-[0.08em] uppercase transition-colors ${
            activeTab === tab.key
              ? "text-primary after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-primary"
              : "text-base-content/55 hover:text-base-content"
          }`}
          onClick={() => setActiveTab(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ) : null;

  // ── Desktop: inline resizable panel — shown whenever there is content ──
  if (isLgUp && hasDetails) {
    return (
      <aside
        aria-label={panel?.title || "Details"}
        className="relative flex h-full min-h-0 shrink-0 flex-col border-l border-base-300 bg-base-100"
        style={{ width: `${panelWidth}px` }}
      >
        {/* Resize handle */}
        <div
          className="absolute inset-y-0 -left-[3px] z-10 w-[6px] cursor-col-resize transition-colors hover:bg-primary/20 active:bg-primary/30"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onDoubleClick={onDoubleClick}
          title="Drag to resize · double-click to reset"
          aria-hidden
        />

        {/* Header */}
        <div className="flex min-h-15 shrink-0 items-center gap-2 border-b border-base-300 px-4">
          <h2 className="op-label min-w-0 truncate text-base-content">
            {panel?.title || "Details"}
          </h2>
        </div>

        {tabsBar}

        <div
          key={contentKey}
          className="min-h-0 flex-1 animate-[op-panel-fade-in_150ms_ease-out] overflow-y-auto overscroll-contain p-4"
        >
          {renderedContent}
        </div>
      </aside>
    );
  }

  // ── Mobile: full-screen overlay (only when content exists) ──
  if (!isLgUp && isOpen && hasDetails && panel) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-base-content/40"
          onClick={close}
          aria-hidden
        />

        {/* Panel */}
        <aside
          aria-label={panel.title || "Details"}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-base-100 animate-[slideInRight_0.2s_ease-out]"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="flex min-h-15 shrink-0 items-center gap-2 border-b border-base-300 px-3">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square shrink-0"
              onClick={close}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="op-label min-w-0 flex-1 truncate text-base-content">
              {panel.title || "Details"}
            </h2>
          </div>

          {tabsBar}

          <div
            key={contentKey}
            className="min-h-0 flex-1 animate-[op-panel-fade-in_150ms_ease-out] overflow-y-auto overscroll-contain p-4"
          >
            {renderedContent}
          </div>
        </aside>
      </>
    );
  }

  return null;
}
