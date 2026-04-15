import { SegmentsPageClient } from "@/components/contacts/SegmentsPageClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { serverFetch } from "@/lib/server-fetch";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function PeopleSegmentsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const canManageSegments = roleHasWorkspacePermission(
    String(me.role),
    "contacts.create"
  );

  return (
    <PageContainer>
      <PageHeader
        title="Segments"
        description={
          canManageSegments
            ? "Create and manage saved people segments."
            : "View saved people segments."
        }
      />
      <SegmentsPageClient canManageSegments={canManageSegments} />
    </PageContainer>
  );
}

