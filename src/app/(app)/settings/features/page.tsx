import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { FeaturesClient } from "@/components/settings/FeaturesClient";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function FeaturesPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const allowed = roleHasWorkspacePermission(String(me.role), "settings.manage");

  if (!allowed) {
    return (
      <PageContainer>
        <PageHeader
          title="Features"
          description="Turn optional modules on or off for this workspace."
        />
        <p className="text-sm text-base-content/65">
          You don&apos;t have permission to manage workspace features.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Features"
        description="Turn optional modules on or off for this workspace. Disabled modules are hidden from the sidebar."
      />
      <FeaturesClient
        workspaceId={me.workspace.id}
        commerceEnabled={Boolean(me.workspace.commerceEnabled)}
        recurringEnabled={Boolean(me.workspace.recurringEnabled)}
      />
    </PageContainer>
  );
}
