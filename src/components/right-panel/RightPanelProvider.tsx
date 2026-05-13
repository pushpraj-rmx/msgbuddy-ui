"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LG_MEDIA_QUERY } from "@/hooks/useMediaQuery";

const DETAILS_PANE_OPEN_KEY = "global-details-pane-open";

function readStoredPaneOpen(): boolean {
  try {
    const raw = localStorage.getItem(DETAILS_PANE_OPEN_KEY);
    if (raw === "true" || raw === "false") return raw === "true";
  } catch {
    // ignore
  }
  return false;
}

/** A single tab inside the panel. */
export type PanelTab = {
  key: string;
  label: string;
  content: ReactNode;
};

type RightPanelState = {
  title?: string;
  content?: ReactNode;
  source?: string;
  tabs?: PanelTab[];
  defaultTab?: string;
};

type SetRightPanelInput = {
  title?: string;
  /** Flat content — mutually exclusive with `tabs`. */
  content?: ReactNode;
  source?: string;
  /** Tabbed content — mutually exclusive with `content`. */
  tabs?: PanelTab[];
  /** Initial active tab key when using tabs. Defaults to first tab. */
  defaultTab?: string;
  /**
   * When true, opens the panel after setting content (e.g. user selected an item with details).
   * Omit or false when only syncing placeholder/updated content without a new selection.
   */
  openAfter?: boolean;
};

type RightPanelContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  panel: RightPanelState | null;
  setContent: (input: SetRightPanelInput) => void;
  clearContent: (source?: string) => void;
  /** Currently active tab key (when panel uses tabs). */
  activeTab: string;
  setActiveTab: (key: string) => void;
};

const RightPanelContext = createContext<RightPanelContextValue | null>(null);

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [panel, setPanel] = useState<RightPanelState | null>(null);
  const [activeTab, setActiveTab] = useState("");

  // Restore desktop preference on mount (mobile starts closed; opens via setContent or toggle)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const lg = window.matchMedia(LG_MEDIA_QUERY).matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration guard: reads localStorage after mount
    if (lg) setIsOpen(readStoredPaneOpen());
  }, []);

  const persistOpen = useCallback((next: boolean) => {
    try {
      localStorage.setItem(DETAILS_PANE_OPEN_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    persistOpen(true);
  }, [persistOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    persistOpen(false);
  }, [persistOpen]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      persistOpen(next);
      return next;
    });
  }, [persistOpen]);

  const setContent = useCallback(
    (input: SetRightPanelInput) => {
      setPanel({
        title: input.title,
        content: input.content,
        source: input.source,
        tabs: input.tabs,
        defaultTab: input.defaultTab,
      });
      // Reset tab to default when content changes
      setActiveTab(input.defaultTab ?? input.tabs?.[0]?.key ?? "");
      if (input.openAfter === true) {
        setIsOpen(true);
        persistOpen(true);
      }
    },
    [persistOpen]
  );

  const clearContent = useCallback((source?: string) => {
    setPanel((prev) => {
      if (!prev) return prev;
      if (!source) return null;
      return prev.source === source ? null : prev;
    });
  }, []);

  const value = useMemo<RightPanelContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      panel,
      setContent,
      clearContent,
      activeTab,
      setActiveTab,
    }),
    [activeTab, clearContent, close, isOpen, open, panel, setContent, toggle]
  );

  return (
    <RightPanelContext.Provider value={value}>
      {children}
    </RightPanelContext.Provider>
  );
}

export function useRightPanel() {
  const context = useContext(RightPanelContext);
  if (!context) {
    throw new Error("useRightPanel must be used within RightPanelProvider.");
  }
  return context;
}
