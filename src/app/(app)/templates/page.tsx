import { TemplatesClient } from "@/components/templates/TemplatesClient";

export default function TemplatesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-sm text-base-content/60">
          Create and manage message templates. Search, filter, sort, and
          preview on demand.
        </p>
      </div>
      <TemplatesClient />
    </div>
  );
}
