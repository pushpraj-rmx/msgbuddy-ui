import type { ReactNode } from "react";
import { PlatformNav } from "@/components/platform/PlatformNav";
import { AccessDenied } from "@/components/platform/AccessDenied";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

/**
 * Unified platform-owner console. One section, grouped left sub-nav (Overview,
 * Tenants, Logs, Channels, Operations) — the single home for everything the
 * platform owner / support staff need. Gate is enforced here AND re-checked in
 * every child page for defence-in-depth.
 */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessPlatform(me.platformRole)) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <AccessDenied title="Platform" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 lg:flex-row lg:gap-8">
      <aside className="shrink-0 lg:w-56 lg:py-1">
        <PlatformNav platformRole={me.platformRole} />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}
