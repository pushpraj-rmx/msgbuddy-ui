import { notFound } from "next/navigation";
import { ContactDetailClient } from "@/components/contacts/ContactDetailClient";
import { serverFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { Contact } from "@/lib/types";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let contact: Contact;
  let me: { user: { id: string } };
  try {
    [contact, me] = await Promise.all([
      serverFetch<Contact>(
        `${endpoints.contacts.byId(id)}?include=tags,customFields`
      ),
      serverFetch<{ user: { id: string } }>(endpoints.auth.me),
    ]);
  } catch {
    notFound();
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Contact</h1>
        <p className="text-sm text-base-content/60">
          View and edit contact details, tags, notes, and activity.
        </p>
      </div>
      <ContactDetailClient
        initialContact={contact}
        currentUserId={me.user.id}
      />
    </div>
  );
}
