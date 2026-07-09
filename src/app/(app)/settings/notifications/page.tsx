import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationPreferencesClient } from "@/components/settings/NotificationPreferencesClient";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

export default async function NotificationSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        description="Manage browser push notifications for new messages and alerts."
      />
      <section className="space-y-3">
        <span className="op-section-title">Browser notifications</span>
        <NotificationPreferencesClient workspaceId={me.workspace.id} />
      </section>
    </PageContainer>
  );
}
