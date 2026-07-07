import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspaceGeneralClient } from "@/components/settings/WorkspaceGeneralClient";
import type { Member, Workspace, WorkspaceSettings } from "@/components/settings/types";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function WorkspaceSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!roleHasWorkspacePermission(String(me.role), "settings.manage")) {
    redirect("/settings/account");
  }

  const workspace = await serverFetch<Workspace>(
    endpoints.workspaces.byId(me.workspace.id)
  );
  const [settings, members] = await Promise.all([
    serverFetch<WorkspaceSettings>(endpoints.workspaces.settings(me.workspace.id)).catch(
      () => ({ timezone: workspace.timezone, locale: workspace.locale }) as WorkspaceSettings
    ),
    serverFetch<Member[]>(endpoints.workspaces.members(me.workspace.id)).catch(
      () => [] as Member[]
    ),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Workspace"
        description="Workspace name, locale, timezone, and business profile."
      />
      <WorkspaceGeneralClient
        workspace={workspace}
        settings={settings}
        memberCount={members.length}
      />
    </PageContainer>
  );
}
