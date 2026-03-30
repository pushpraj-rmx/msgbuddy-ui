import { TemplatesClient } from "@/components/templates/TemplatesClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

export default function TemplatesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Templates"
        description="Create and manage message templates. Search, filter, sort, and preview on demand."
      />
      <TemplatesClient />
    </PageContainer>
  );
}
