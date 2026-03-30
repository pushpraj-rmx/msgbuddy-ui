import { ContactsPageClient } from "@/components/contacts/ContactsPageClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverFetch, type MeResponse } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { ContactsListResponse } from "@/lib/types";

export default async function ContactsPage() {
  const [me, listResponse] = await Promise.all([
    serverFetch<MeResponse>(endpoints.auth.me),
    serverFetch<ContactsListResponse>(
      `${endpoints.contacts.list}?limit=50&sort=name&order=asc&includeTotal=true&include=tags,customFields`
    ),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="People & Organizations"
        description="Manage contacts and filter by segment."
      />
      <ContactsPageClient
        workspaceId={me.workspace.id}
        initialContacts={listResponse.contacts}
        initialNextCursor={listResponse.nextCursor ?? undefined}
        initialTotalCount={listResponse.totalCount}
      />
    </PageContainer>
  );
}
