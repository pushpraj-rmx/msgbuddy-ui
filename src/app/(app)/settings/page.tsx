import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsClient } from "@/components/settings/SettingsClient";
import type {
  Member,
  Workspace,
  WorkspaceSettings,
} from "@/components/settings/SettingsClient";
import type {
  MeResponse,
  WorkspaceCloudApiConfigResponse,
} from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

async function getCloudApiSafe(
  workspaceId: string
): Promise<WorkspaceCloudApiConfigResponse | null> {
  try {
    return await serverFetch<WorkspaceCloudApiConfigResponse>(
      endpoints.workspaces.cloudApi(workspaceId)
    );
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const [workspace, settings, members, cloudApiConfig] =
    await Promise.all([
      serverFetch<Workspace>(endpoints.workspaces.byId(me.workspace.id)),
      serverFetch<WorkspaceSettings>(endpoints.workspaces.settings(me.workspace.id)),
      serverFetch<Member[]>(endpoints.workspaces.members(me.workspace.id)),
      getCloudApiSafe(me.workspace.id),
    ]);

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage workspace details and access."
      />
      <SettingsClient
        workspace={workspace}
        settings={settings}
        members={members}
        cloudApiConfig={cloudApiConfig}
        meRole={me.role}
      />
    </PageContainer>
  );
}
