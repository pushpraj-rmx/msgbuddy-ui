import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { CannedResponsesClient } from "@/components/canned-responses/CannedResponsesClient";
import type { MeResponse, CannedResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function CannedResponsesPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const canManage = roleHasWorkspacePermission(
    String(me.role),
    "settings.manage",
  );

  const initial = await serverFetch<CannedResponse[]>(
    endpoints.cannedResponses.list,
  ).catch(() => [] as CannedResponse[]);

  return (
    <PageContainer>
      <PageHeader
        title="Canned responses"
        description="Save your most-used replies as `/shortcut` snippets. Agents trigger them with one keystroke in the inbox."
      />
      <CannedResponsesClient initial={initial} canManage={canManage} />
    </PageContainer>
  );
}
