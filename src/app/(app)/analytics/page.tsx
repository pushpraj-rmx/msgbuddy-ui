import { AnalyticsClient } from "@/components/analytics/AnalyticsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function AnalyticsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="Track delivery, engagement, and channel performance."
      />
      <AnalyticsClient />
    </PageContainer>
  );
}
