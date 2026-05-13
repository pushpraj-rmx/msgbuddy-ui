import { notFound } from "next/navigation";
import { ContactDetailClient } from "@/components/contacts/ContactDetailClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import type { Contact } from "@/lib/types";

export default async function PeopleContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let contact: Contact;
  let me: { user: { id: string }; role: string };
  try {
    [contact, me] = await Promise.all([
      serverFetch<Contact>(
        `${endpoints.contacts.byId(id)}?include=tags,customFields`
      ),
      serverFetch<{ user: { id: string }; role: string }>(endpoints.auth.me),
    ]);
  } catch {
    notFound();
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Contact" description="View and edit contact details, tags, notes, and activity." />
      <ContactDetailClient
        initialContact={contact}
        currentUserId={me.user.id}
        meRole={String(me.role)}
      />
    </div>
  );
}

