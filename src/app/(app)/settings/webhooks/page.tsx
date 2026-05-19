import { redirect } from "next/navigation";
import { WebhooksClient } from "@/components/settings/WebhooksClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type {
  MeResponse,
  WebhookEndpointResponseDto,
} from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function WebhooksSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!roleHasWorkspacePermission(me.role, "settings.manage")) {
    redirect("/settings");
  }

  const initialEndpoints = await serverFetch<WebhookEndpointResponseDto[]>(
    endpoints.webhookEndpoints.list,
  ).catch(() => [] as WebhookEndpointResponseDto[]);

  return (
    <PageContainer>
      <PageHeader
        title="Webhooks"
        description="Push real-time message and template events into your apps."
      />
      <WebhooksClient initialEndpoints={initialEndpoints} />
    </PageContainer>
  );
}
