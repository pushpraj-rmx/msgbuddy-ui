import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { TasksClient } from "@/components/tasks/TasksClient";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function TasksPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const canManage = roleHasWorkspacePermission(String(me.role), "tasks.manage");

  return (
    <PageContainer>
      <PageHeader
        title="Tasks"
        description="Your follow-ups, reminders, and to-dos. Distinct from scheduled messages — these are things you need to do."
      />
      <TasksClient canManage={canManage} />
    </PageContainer>
  );
}
