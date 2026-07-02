import type { ReactNode } from "react";

/**
 * Public storefront shell (2A). Intentionally free of the app's authed chrome
 * (no sidebar/topbar). Mobile-first — most visitors arrive by scanning a QR with
 * their phone. Uses the shared design tokens so it themes consistently.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-base-100 text-base-content">
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">{children}</div>
    </div>
  );
}
