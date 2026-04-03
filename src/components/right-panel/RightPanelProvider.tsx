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

/** Matches Tailwind `xl` (default 1280px). Close desktop panel when below this width. */
const RIGHT_PANEL_DESKTOP_MQ = "(min-width: 1280px)";

const RIGHT_PANEL_OPEN_KEY = "global-right-panel-open";

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

function getInitialOpenState(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(RIGHT_PANEL_OPEN_KEY);
    if (raw === "true" || raw === "false") {
      return raw === "true";
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState<boolean>(getInitialOpenState);
  const [panel, setPanel] = useState<RightPanelState | null>(null);

  const persistOpenState = useCallback((next: boolean) => {
    try {
      localStorage.setItem(RIGHT_PANEL_OPEN_KEY, String(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    persistOpenState(true);
  }, [persistOpenState]);

  const close = useCallback(() => {
    setIsOpen(false);
    persistOpenState(false);
  }, [persistOpenState]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      persistOpenState(next);
      return next;
    });
  }, [persistOpenState]);

  const setContent = useCallback((input: SetRightPanelInput) => {
    setPanel({
      title: input.title,
      content: input.content,
      source: input.source,
    });
    if (input.openAfter === true) {
      setIsOpen(true);
      persistOpenState(true);
    }
  }, [persistOpenState]);

  const clearContent = useCallback((source?: string) => {
    setPanel((prev) => {
      if (!prev) return prev;
      if (!source) return null;
      return prev.source === source ? null : prev;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(RIGHT_PANEL_DESKTOP_MQ);
    const apply = () => {
      if (!mq.matches) close();
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [close]);

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
