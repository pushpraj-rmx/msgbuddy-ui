import { AccessDenied } from "@/components/platform/AccessDenied";
import { WebhookLogsTab } from "@/components/platform/PlatformConsoleClient";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessPlatform } from "@/lib/platform-access";

export default async function PlatformWebhookLogsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!canAccessPlatform(me.platformRole)) {
    return <AccessDenied title="Webhook logs" />;
  }
  return (
    <>
      <PageHeader title="Webhook logs" description="Inbound provider webhooks across all workspaces." />
      <WebhookLogsTab />
    </>
  );
}
