import { IntegrationsSettingsClient } from "@/components/integrations/IntegrationsSettingsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
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

function isWhatsAppConnected(config: WorkspaceCloudApiConfigResponse | null) {
  return config != null && (config.status === "ACTIVE" || config.hasAccessToken);
}

export default async function IntegrationsSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
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

