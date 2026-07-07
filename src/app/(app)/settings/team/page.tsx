import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamClient } from "@/components/settings/TeamClient";
import type { Member } from "@/components/settings/types";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function TeamSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!roleHasWorkspacePermission(String(me.role), "members.view")) {
    redirect("/settings/account");
  }

  const members = await serverFetch<Member[]>(
    endpoints.workspaces.members(me.workspace.id)
  ).catch(() => [] as Member[]);

  return (
    <PageContainer>
      <PageHeader
        title="Team & roles"
        description="Invite teammates and manage their workspace roles."
      />
      <section className="space-y-3">
        <span className="op-section-title">Team Members</span>
        <TeamClient
          workspaceId={me.workspace.id}
          initialMembers={members}
          meRole={me.role}
          meUserId={me.user.id}
        />
      </section>
    </PageContainer>
  );
}
