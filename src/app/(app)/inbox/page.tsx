import { InboxClient, type Conversation } from "@/components/inbox/InboxClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";

export default async function InboxPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const initialConversations = await serverFetch<Conversation[]>(
    `${endpoints.conversations.list}?status=OPEN&limit=50`
  );

  return (
    <PageContainer className="flex min-h-0 flex-1 flex-col overflow-hidden !gap-0">
      <PageHeader
        title="Inbox"
        description="Manage conversations and reply in real-time."
      />
      <InboxClient
        key={me.workspace.id}
        initialConversations={initialConversations}
        workspaceId={me.workspace.id}
        currentUserId={me.user.id}
        meRole={String(me.role)}
      />
    </PageContainer>
  );
}
