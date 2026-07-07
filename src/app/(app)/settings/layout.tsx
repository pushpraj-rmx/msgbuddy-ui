import type { ReactNode } from "react";
import { SettingsNav, type SettingsNavGating } from "@/components/settings/SettingsNav";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";
import {
  canAccessBillingPage,
  canAccessUsagePage,
  canDeleteWorkspace,
} from "@/lib/workspace-access";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const role = String(me.role);

  const gating: SettingsNavGating = {
    canManageSettings: roleHasWorkspacePermission(role, "settings.manage"),
    canViewMembers: roleHasWorkspacePermission(role, "members.view"),
    canManageAutomations: roleHasWorkspacePermission(role, "automations.manage"),
    canSeeBilling: canAccessBillingPage(role),
    canAccessUsage: canAccessUsagePage(role),
    canDeleteWorkspace: canDeleteWorkspace(role),
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 lg:flex-row lg:gap-8">
      <aside className="shrink-0 lg:w-56 lg:py-1">
        <SettingsNav gating={gating} />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <SettingsHeader />
        {children}
      </div>
    </div>
  );
}
