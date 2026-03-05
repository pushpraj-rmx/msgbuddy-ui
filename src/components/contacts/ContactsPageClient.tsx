"use client";

import { useSearchParams } from "next/navigation";
import { ContactsListClient } from "./ContactsListClient";
import { SegmentPicker } from "./SegmentPicker";
import type { Contact } from "@/lib/types";

export function ContactsPageClient({
  initialContacts,
  initialNextCursor,
  initialTotalCount,
}: {
  initialContacts: Contact[];
  initialNextCursor?: string;
  initialTotalCount?: number;
}) {
  const searchParams = useSearchParams();
  const segmentIdFromUrl = searchParams.get("segment");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <SegmentPicker />
      </div>
      <ContactsListClient
        initialContacts={initialContacts}
        initialNextCursor={initialNextCursor}
        initialTotalCount={initialTotalCount}
        selectedSegmentId={segmentIdFromUrl}
      />
    </div>
  );
}
