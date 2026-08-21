import type { ReactNode } from "react";

/**
 * Public storefront shell (2A). Intentionally free of the app's authed chrome
 * (no sidebar/topbar). Mobile-first — most visitors arrive by scanning a QR with
 * their phone — but comfortable on desktop too (centered, readable column on a
 * subtly toned canvas). Uses the shared design tokens so it themes consistently.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    // Pinned to the light theme. The root <html> theme comes from the viewer's
    // own `theme-preference` in localStorage, which is a dashboard setting — a
    // customer arriving by QR should not get whatever palette the merchant's
    // operator happens to prefer, and the brand reads as a bakery in light.
    <div data-theme="light" className="op-canvas h-dvh overflow-y-auto text-base-content">
      {/* faint top canvas wash — reads on both dark and light themes */}
      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-20 pt-8 sm:pt-12">
        {children}
      </div>
    </div>
  );
}
