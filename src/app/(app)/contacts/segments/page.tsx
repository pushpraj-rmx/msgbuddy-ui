import { SegmentsPageClient } from "@/components/contacts/SegmentsPageClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ContactsSegmentsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Segments"
        description="Create and manage saved contact segments."
      />
      <SegmentsPageClient />
    </PageContainer>
  );
}
