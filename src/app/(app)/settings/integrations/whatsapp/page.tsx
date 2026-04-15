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

type SafeSettingsResult = {
  settings: WorkspaceSettings;
  permissionMessage: string | null;
};

function isWorkspaceSettingsForbidden(error: unknown): boolean {
  if (!(error instanceof Error) || !error.message) return false;
  try {
    const parsed = JSON.parse(error.message) as {
      statusCode?: number;
      message?: string;
      error?: string;
    };
    return (
      parsed.statusCode === 403 &&
      typeof parsed.message === "string" &&
      parsed.message.toLowerCase().includes("workspace settings")
    );
  } catch {
    return false;
  }
}

async function getWorkspaceSettingsSafe(
  workspaceId: string
): Promise<SafeSettingsResult> {
  try {
    const settings = await serverFetch<WorkspaceSettings>(
      endpoints.workspaces.settings(workspaceId)
    );
    return { settings, permissionMessage: null };
  } catch (error: unknown) {
    if (isWorkspaceSettingsForbidden(error)) {
      return {
        settings: {},
        permissionMessage:
          "You do not have permission to read workspace settings. Some WhatsApp settings may be limited.",
      };
    }
    throw error;
  }
}

export default async function WhatsAppIntegrationRoute() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const [cloudApiConfig, settingsResult] = await Promise.all([
    getCloudApiSafe(me.workspace.id),
    getWorkspaceSettingsSafe(me.workspace.id),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="WhatsApp"
        description="Connect and configure WhatsApp for this workspace."
      />
      {settingsResult.permissionMessage ? (
        <div role="alert" className="alert alert-warning mb-4">
          <span>{settingsResult.permissionMessage}</span>
        </div>
      ) : null}
      <WhatsAppSettingsClient
        key={me.workspace.id}
        workspaceId={me.workspace.id}
        settings={settingsResult.settings}
        cloudApiConfig={cloudApiConfig}
      />
    </PageContainer>
  );
}
