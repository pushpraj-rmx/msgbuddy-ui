import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { DangerZoneClient } from "@/components/settings/DangerZoneClient";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canDeleteWorkspace } from "@/lib/workspace-access";

export default async function DangerZonePage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!canDeleteWorkspace(String(me.role))) {
    redirect("/settings/account");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Danger zone"
        description="Archive the workspace or permanently purge contacts."
      />
      <DangerZoneClient workspaceId={me.workspace.id} workspaceName={me.workspace.name} />
    </PageContainer>
  );
}
