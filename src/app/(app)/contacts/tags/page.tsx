import { TagsManagerClient } from "@/components/contacts/TagsManagerClient";

export default function TagsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Tags</h1>
        <p className="text-sm text-base-content/60">
          Create and manage tags to organize contacts. Assign tags in contact
          details or select multiple contacts and add a tag in bulk.
        </p>
      </div>
      <TagsManagerClient />
    </div>
  );
}
