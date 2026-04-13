import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/states";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import type { Member } from "@/components/settings/SettingsClient";
import { TeamClient } from "@/components/settings/TeamClient";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function SettingsTeamPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!roleHasWorkspacePermission(me.role, "members.view")) {
    return (
      <PageContainer>
        <PageHeader title="Team" description="Workspace members and roles." />
        <div role="alert" className="alert alert-warning">
          <span>You don’t have permission to view the team directory.</span>
        </div>
      </PageContainer>
    );
  }

  const members = await serverFetch<Member[]>(
    endpoints.workspaces.members(me.workspace.id)
  );

  return (
    <PageContainer>
      <PageHeader title="Team" description="Manage workspace members and roles." />
      {!members.length ? (
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <EmptyState
            title="No members found"
            description="Invite teammates to collaborate in this workspace."
          />
        </div>
      ) : null}

      <TeamClient
        key={me.workspace.id}
        workspaceId={me.workspace.id}
        initialMembers={members}
        meRole={me.role}
        meUserId={me.user.id}
      />
    </PageContainer>
  );
}
