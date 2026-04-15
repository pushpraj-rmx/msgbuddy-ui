import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
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

function isWhatsAppConnected(
  config: WorkspaceCloudApiConfigResponse | null
): boolean {
  return (
    config != null &&
    (config.status === "ACTIVE" || config.hasAccessToken === true)
  );
}

export default async function DashboardPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const isViewer = !roleHasWorkspacePermission(String(me.role), "contacts.create");
  const cloudApiConfig = isViewer ? null : await getCloudApiSafe(me.workspace.id);
  const showConnectWhatsAppTodo = !isViewer && !isWhatsAppConnected(cloudApiConfig);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${me.user?.email ?? "User"}.`}
      />

      <DashboardClient meRole={String(me.role)} />

      {showConnectWhatsAppTodo && (
        <IntegrationCard
          name="WhatsApp"
          description="Connect your WhatsApp Business account to start messaging customers."
          status="disconnected"
          actionLabel="Connect"
          href="/settings/integrations/whatsapp"
        />
      )}
    </PageContainer>
  );
}
