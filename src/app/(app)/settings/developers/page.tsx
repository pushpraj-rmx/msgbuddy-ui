import { redirect } from "next/navigation";
import { DevelopersClient } from "@/components/settings/DevelopersClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ApiKeyResponseDto, MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function DevelopersSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  // Defence-in-depth: backend enforces SETTINGS_MANAGE on every route below,
  // but bouncing the URL keeps the dropdown menu honest and removes the
  // chance of a half-rendered page leaking row counts.
  if (!roleHasWorkspacePermission(me.role, "settings.manage")) {
    redirect("/settings");
  }

  const initialKeys = await serverFetch<ApiKeyResponseDto[]>(
    endpoints.apiKeys.list,
  ).catch(() => [] as ApiKeyResponseDto[]);

  return (
    <PageContainer>
      <PageHeader
        title="Developers"
        description="Generate and manage API keys for external integrations."
      />
      <DevelopersClient initialKeys={initialKeys} />
    </PageContainer>
  );
}
