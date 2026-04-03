"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { useRightPanel } from "./useRightPanel";

function isWideViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(min-width: 1280px)").matches;
}

export function GlobalRightPanel() {
  const { isOpen, panel } = useRightPanel();
  const pathname = usePathname();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const prevPathnameRef = useRef(pathname);

  /* `panel.content` is a new React element whenever parents call setContent — do not use it as an effect dep (infinite layout loops). */
  const panelKey = panel
    ? `${panel.source ?? ""}\0${panel.title ?? ""}`
    : "";

  /* Close sheet when the route changes (not on initial mount). */
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    setMobileSheetOpen(false);
  }, [pathname]);

  /* Open sheet on small viewports only — do not trust isLgUp on first paint (hook starts false). */
  useLayoutEffect(() => {
    if (isWideViewport()) {
      setMobileSheetOpen((prev) => (prev ? false : prev));
      return;
    }
    if (!panelKey) {
      setMobileSheetOpen((prev) => (prev ? false : prev));
      return;
    }
    setMobileSheetOpen((prev) => (prev ? prev : true));
  }, [panelKey]);

  const showMobileSheet =
    !isWideViewport() && !!panel?.content && mobileSheetOpen;

  return (
    <>
      {/* Desktop / large tablet: fixed column — expand/collapse lives in Topbar */}
      {isOpen ? (
        <div className="relative hidden h-full shrink-0 xl:flex">
          <aside className="flex h-full w-[380px] min-w-0 flex-col border-l border-base-content/15 bg-base-200 shadow-sm">
            <div className="flex h-14 shrink-0 items-center border-b border-base-300 px-3">
              <h2 className="truncate text-sm font-medium text-base-content/80">
                {panel?.title || "Details"}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {panel?.content ? (
                panel.content
              ) : (
                <div className="flex min-h-[8rem] items-center justify-center rounded-box border border-dashed border-base-300 bg-base-100 p-6 text-center">
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
        </div>
      ) : null}

      {/* Small / medium — never mount mobile overlay on xl+ (avoids blocking sidebar / nav). */}
      <div className="xl:hidden">
        {showMobileSheet ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-base-content/20"
              aria-label="Close details"
              onClick={() => setMobileSheetOpen(false)}
            />
            <div
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(92dvh,920px)] flex-col rounded-t-2xl border border-b-0 border-base-300 bg-base-100 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-right-panel-mobile-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-base-300 px-3 py-2 pt-3">
              <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-base-300" aria-hidden />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-[env(safe-area-inset-bottom,0px)]">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
                <h2
                  id="global-right-panel-mobile-title"
                  className="truncate text-sm font-medium text-base-content/80"
                >
                  {panel?.title || "Details"}
                </h2>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  onClick={() => setMobileSheetOpen(false)}
                  aria-label="Close details"
                >
                  <CloseRounded className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">{panel.content}</div>
            </div>
            </div>
          </>
        ) : null}

        {panel?.content && !mobileSheetOpen ? (
          <button
            type="button"
            className="btn btn-primary btn-sm fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] right-3 z-30 shadow-md"
            onClick={() => setMobileSheetOpen(true)}
          >
            Details
          </button>
        ) : null}
      </div>
    </>
  );
}
