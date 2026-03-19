import { WhatsAppSettingsClient } from "@/components/integrations/WhatsAppSettingsClient";
import {
  serverFetch,
  type MeResponse,
  type WorkspaceCloudApiConfigResponse,
  type WorkspaceMessagingConfigPayload,
} from "@/lib/api";
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
  const cloudApiConfig = await getCloudApiSafe(me.workspace.id);
  const [settings, messagingConfig] = await Promise.all([
    serverFetch<WorkspaceSettings>(endpoints.workspaces.settings(me.workspace.id)),
    // TODO: BSP | Fallback to BSP when messaging config fails; handle or remove when BSP is deprecated
    serverFetch<WorkspaceMessagingConfigPayload>(
      endpoints.workspaces.messagingConfig(me.workspace.id)
    ).catch(() => ({ providerType: "BSP" as const })),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
        <p className="text-sm text-base-content/60">
          Connect and configure WhatsApp for this workspace.
        </p>
      </div>
      <WhatsAppSettingsClient
        workspaceId={me.workspace.id}
        settings={settings}
        messagingConfig={messagingConfig}
        cloudApiConfig={cloudApiConfig}
      />
    </div>
  );
}
