import { InboxClient, type Conversation } from "@/components/inbox/InboxClient";
import { serverFetch, type MeResponse } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

export default async function InboxPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const initialConversations = await serverFetch<Conversation[]>(
    `${endpoints.conversations.list}?status=OPEN&limit=50`
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-sm text-base-content/60">
          Manage conversations and reply in real-time.
        </p>
      </div>
      <InboxClient
        initialConversations={initialConversations}
        workspaceId={me.workspace.id}
      />
    </div>
  );
}
