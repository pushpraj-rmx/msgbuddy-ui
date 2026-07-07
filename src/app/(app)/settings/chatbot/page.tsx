import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChatbotSettingsClient } from "@/components/settings/ChatbotSettingsClient";
import type { WorkspaceSettings } from "@/components/settings/types";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function ChatbotSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  if (!roleHasWorkspacePermission(String(me.role), "settings.manage")) {
    redirect("/settings/account");
  }

  const settings = await serverFetch<WorkspaceSettings>(
    endpoints.workspaces.settings(me.workspace.id)
  ).catch(() => ({}) as WorkspaceSettings);

  return (
    <PageContainer>
      <PageHeader
        title="Chatbot"
        description="Automatically reply to unassigned conversations with an LLM."
      />
      <ChatbotSettingsClient workspaceId={me.workspace.id} settings={settings} />
    </PageContainer>
  );
}
