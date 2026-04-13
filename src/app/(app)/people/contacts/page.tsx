import { ContactsPageClient } from "@/components/contacts/ContactsPageClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import type { ContactsListResponse } from "@/lib/types";

export default async function PeopleContactsPage() {
  const [me, initialContacts] = await Promise.all([
    serverFetch<MeResponse>(endpoints.auth.me),
    serverFetch<ContactsListResponse>(
      `${endpoints.contacts.list}?limit=50&includeTotal=true&include=tags,customFields&sort=lastMessageAt&order=desc`
    ),
  ]);

  return (
    <PageContainer className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Contacts"
        description="Manage people and jump into Inbox when you need to message."
      />
      <ContactsPageClient
        key={me.workspace.id}
        workspaceId={me.workspace.id}
        initialContacts={initialContacts.contacts ?? []}
        initialNextCursor={initialContacts.nextCursor ?? undefined}
        initialTotalCount={initialContacts.totalCount}
      />
    </PageContainer>
  );
}

