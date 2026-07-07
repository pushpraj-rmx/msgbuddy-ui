"use client";

import { usePathname } from "next/navigation";
import { getPageTitle } from "@/lib/navigation";

/**
 * Visible page heading for the settings section. Individual pages keep their
 * sr-only PageHeader for the accessibility tree + Topbar breadcrumb; this
 * restores the prominent on-page title the old single-page hub used to show.
 */
export function SettingsHeader() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="shrink-0">
      <span className="op-label">settings</span>
      <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em]">{title}</h1>
    </header>
  );
}
