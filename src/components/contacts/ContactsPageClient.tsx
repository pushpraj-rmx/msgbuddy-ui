"use client";

import { useSearchParams } from "next/navigation";
import { ContactsListClient } from "./ContactsListClient";
import type { Contact } from "@/lib/types";

export function ContactsPageClient({
  workspaceId,
  initialContacts,
  initialNextCursor,
  initialTotalCount,
  meRole,
}: {
  workspaceId: string;
  initialContacts: Contact[];
  initialNextCursor?: string;
  initialTotalCount?: number;
  meRole: string;
}) {
  const searchParams = useSearchParams();
  const segmentIdFromUrl = searchParams.get("segment");

  return (
    <div className="space-y-3">
      <ContactsListClient
        workspaceId={workspaceId}
        initialContacts={initialContacts}
        initialNextCursor={initialNextCursor}
        initialTotalCount={initialTotalCount}
        selectedSegmentId={segmentIdFromUrl}
        meRole={meRole}
      />
    </div>
  );
}
