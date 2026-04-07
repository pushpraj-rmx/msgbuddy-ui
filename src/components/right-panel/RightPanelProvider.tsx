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
import { XL_MEDIA_QUERY } from "@/hooks/useMediaQuery";

const DETAILS_PANE_OPEN_KEY = "global-details-pane-open";

function readStoredPaneOpen(): boolean {
  try {
    const raw = localStorage.getItem(DETAILS_PANE_OPEN_KEY);
    if (raw === "true" || raw === "false") return raw === "true";
  } catch {
    // ignore
  }
  return true;
}

type RightPanelState = {
  title?: string;
  content: ReactNode;
  source?: string;
};

type SetRightPanelInput = {
  title?: string;
  content: ReactNode;
  source?: string;
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
};

const RightPanelContext = createContext<RightPanelContextValue | null>(null);

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [panel, setPanel] = useState<RightPanelState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const xl = window.matchMedia(XL_MEDIA_QUERY).matches;
    setIsOpen(xl && readStoredPaneOpen());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(XL_MEDIA_QUERY);
    const onChange = () => {
      if (!mq.matches) {
        setIsOpen(false);
        return;
      }
      setIsOpen(readStoredPaneOpen());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
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
      });
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
    }),
    [clearContent, close, isOpen, open, panel, setContent, toggle]
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
