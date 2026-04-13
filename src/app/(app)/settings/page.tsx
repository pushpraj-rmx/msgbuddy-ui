import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsClient } from "@/components/settings/SettingsClient";
import type {
  Member,
  Workspace,
  WorkspaceSettings,
} from "@/components/settings/SettingsClient";
import type {
  LoginHistoryEvent,
  MeResponse,
  WorkspaceCloudApiConfigResponse,
} from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

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
  const canSettings = roleHasWorkspacePermission(me.role, "settings.manage");
  const canMembers = roleHasWorkspacePermission(me.role, "members.view");

  const workspace = await serverFetch<Workspace>(
    endpoints.workspaces.byId(me.workspace.id)
  );

  const [settings, members, cloudApiConfig, loginHistory] = await Promise.all([
    canSettings
      ? serverFetch<WorkspaceSettings>(
          endpoints.workspaces.settings(me.workspace.id)
        )
      : Promise.resolve<WorkspaceSettings>({
          timezone: workspace.timezone,
          locale: workspace.locale,
        }),
    canMembers
      ? serverFetch<Member[]>(endpoints.workspaces.members(me.workspace.id))
      : Promise.resolve<Member[]>([]),
    canSettings ? getCloudApiSafe(me.workspace.id) : Promise.resolve(null),
    serverFetch<LoginHistoryEvent[]>(`${endpoints.auth.loginHistory}?limit=50`).catch(
      () => [] as LoginHistoryEvent[]
    ),
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
        accountEmail={me.user.email}
        accountName={me.user.name}
        accountAvatarUrl={me.user.avatarUrl}
        hasPassword={me.user.hasPassword === true}
        loginHistory={loginHistory}
      />
    </PageContainer>
  );
}
