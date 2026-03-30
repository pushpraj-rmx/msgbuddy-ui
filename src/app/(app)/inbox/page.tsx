import { InboxClient, type Conversation } from "@/components/inbox/InboxClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverFetch, type MeResponse } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

export default async function InboxPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const initialConversations = await serverFetch<Conversation[]>(
    `${endpoints.conversations.list}?status=OPEN&limit=50`
  );

  return (
    <PageContainer className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Inbox"
        description="Manage conversations and reply in real-time."
      />
      <InboxClient
        initialConversations={initialConversations}
        workspaceId={me.workspace.id}
        currentUserId={me.user.id}
      />
    </PageContainer>
  );
}
