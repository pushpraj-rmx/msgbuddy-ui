import { ContactsPageClient } from "@/components/contacts/ContactsPageClient";
import { serverFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { ContactsListResponse } from "@/lib/types";

export default async function ContactsPage() {
  const path = `${endpoints.contacts.list}?limit=50&sort=name&order=asc&includeTotal=true&include=tags,customFields`;
  const listResponse = await serverFetch<ContactsListResponse>(path);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">People & Organizations</h1>
        <p className="text-sm text-base-content/60">
          Manage contacts and filter by segment.
        </p>
      </div>
      <ContactsPageClient
        initialContacts={listResponse.contacts}
        initialNextCursor={listResponse.nextCursor ?? undefined}
        initialTotalCount={listResponse.totalCount}
      />
    </div>
  );
}
