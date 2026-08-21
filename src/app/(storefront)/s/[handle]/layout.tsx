import type { ReactNode } from "react";

/**
 * Public storefront shell (2A). Intentionally free of the app's authed chrome
 * (no sidebar/topbar). Mobile-first — most visitors arrive by scanning a QR with
 * their phone — but comfortable on desktop too (centered, readable column on a
 * subtly toned canvas). Uses the shared design tokens so it themes consistently.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/*
        Force the light theme for the storefront.

        This must go on <html>, not on a wrapper element. globals.css declares
        the --op-* palette on :root, deriving it from --color-base-*; those
        custom properties are resolved where they are DECLARED, so children
        inherit the already-computed root values. Setting data-theme on a nested
        div therefore recolours text (which reads --color-base-content directly)
        while the backgrounds keep the inherited root values — dark text on a
        dark canvas.

        Runs during HTML parse, after the root layout's preference script, so it
        wins without a flash. The root theme comes from the viewer's
        `theme-preference`, which is a dashboard setting a customer arriving by
        QR should never inherit.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.setAttribute("data-theme","light");`,
        }}
      />
      <div className="op-canvas h-dvh overflow-y-auto text-base-content">
        {/* faint top canvas wash — reads on both dark and light themes */}
        <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-20 pt-8 sm:pt-12">
          {children}
        </div>
      </div>
    </>
  );
}
