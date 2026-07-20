import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function ActivityPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const allowed = roleHasWorkspacePermission(String(me.role), "settings.manage");

  if (!allowed) {
    return (
      <PageContainer>
        <PageHeader
          title="Activity log"
          description="Everything that happened in this workspace."
        />
        <p className="text-sm text-base-content/65">
          You don&apos;t have permission to view the workspace activity log.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Activity log"
        description="Every change in this workspace — who did what, when, and what happened. Includes system actions like scheduled auto-retries."
      />
      <ActivityFeed
        workspaceId={me.workspace.id}
        meUserId={me.user.id}
        showFilters
        pageSize={50}
      />
    </PageContainer>
  );
}
