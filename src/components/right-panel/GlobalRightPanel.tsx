"use client";

import { useEffect } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { useMediaQuery, XL_MEDIA_QUERY } from "@/hooks/useMediaQuery";
import { useRightPanel } from "./useRightPanel";

/**
 * Details pane beside main content (xl+ only). Smaller viewports hide the pane;
 * preference is still stored for when the window is wide enough again.
 */
export function GlobalRightPanel() {
  const { isOpen, close, panel } = useRightPanel();
  const isXlUp = useMediaQuery(XL_MEDIA_QUERY);

  useEffect(() => {
    if (!isOpen || !isXlUp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, isXlUp, close]);

  if (!isOpen || !isXlUp) return null;

  return (
    <aside
      aria-label={panel?.title || "Details"}
      className="flex h-full min-h-0 w-[clamp(18rem,28vw,32rem)] shrink-0 flex-col border-l border-base-300 bg-base-100 shadow-sm"
    >
      <div className="flex min-h-0 shrink-0 items-center justify-between gap-2 border-b border-base-300 px-3 py-2.5">
        <h2 className="min-w-0 truncate text-sm font-medium text-base-content/90">
          {panel?.title || "Details"}
        </h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square shrink-0"
          onClick={close}
          aria-label="Close details pane"
        >
          <CloseRounded className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {panel?.content ? (
          panel.content
        ) : (
          <div className="flex min-h-[8rem] items-center justify-center rounded-box border border-dashed border-base-300 bg-base-200/50 p-6 text-center">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">No details</h3>
              <p className="text-xs text-base-content/65">
                Select something on this page to see details here.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
