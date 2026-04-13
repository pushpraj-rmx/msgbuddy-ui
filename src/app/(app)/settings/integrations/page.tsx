import { IntegrationsSettingsClient } from "@/components/integrations/IntegrationsSettingsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type {
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

function isWhatsAppConnected(config: WorkspaceCloudApiConfigResponse | null) {
  return config != null && (config.status === "ACTIVE" || config.hasAccessToken);
}

export default async function IntegrationsSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!roleHasWorkspacePermission(me.role, "settings.manage")) {
    return (
      <PageContainer>
        <PageHeader
          title="Integrations"
          description="Manage external channel connections for this workspace."
        />
        <div role="alert" className="alert alert-warning">
          <span>You don’t have permission to manage integrations.</span>
        </div>
      </PageContainer>
    );
  }

  const cloudApiConfig = await getCloudApiSafe(me.workspace.id);
  const connected = isWhatsAppConnected(cloudApiConfig);

  return (
    <PageContainer>
      <PageHeader
        title="Integrations"
        description="Manage external channel connections for this workspace."
      />
      <IntegrationsSettingsClient whatsappConnected={connected} />
    </PageContainer>
  );
}

