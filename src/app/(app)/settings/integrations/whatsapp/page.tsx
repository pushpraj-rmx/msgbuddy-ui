import { WhatsAppSettingsClient } from "@/components/integrations/WhatsAppSettingsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type {
  MeResponse,
  WorkspaceCloudApiConfigResponse,
} from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import type { WorkspaceSettings } from "@/components/settings/SettingsClient";

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

export default async function WhatsAppIntegrationRoute() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const [cloudApiConfig, settings] = await Promise.all([
    getCloudApiSafe(me.workspace.id),
    serverFetch<WorkspaceSettings>(endpoints.workspaces.settings(me.workspace.id)),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="WhatsApp"
        description="Connect and configure WhatsApp for this workspace."
      />
      <WhatsAppSettingsClient
        workspaceId={me.workspace.id}
        settings={settings}
        cloudApiConfig={cloudApiConfig}
      />
    </PageContainer>
  );
}
