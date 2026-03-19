import { SettingsClient } from "@/components/settings/SettingsClient";
import type {
  Member,
  Workspace,
  WorkspaceSettings,
} from "@/components/settings/SettingsClient";
import {
  serverFetch,
  type MeResponse,
  type WorkspaceCloudApiConfigResponse,
} from "@/lib/api";
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-base-content/60">
          Manage workspace details and access.
        </p>
      </div>
      <SettingsClient
        workspaceId={me.workspace.id}
        workspace={workspace}
        settings={settings}
        members={members}
        cloudApiConfig={cloudApiConfig}
      />
    </div>
  );
}
