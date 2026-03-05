import { WhatsAppIntegrationPage } from "@/components/integrations/WhatsAppIntegrationPage";
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

export default async function WhatsAppIntegrationRoute() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const cloudApiConfig = await getCloudApiSafe(me.workspace.id);

  return (
    <WhatsAppIntegrationPage
      initialCloudApiConfig={cloudApiConfig}
    />
  );
}
