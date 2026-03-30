import { UsageClient } from "@/components/usage/UsageClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

export default function UsagePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Usage"
        description="Track workspace usage, limits, and storage."
      />
      <UsageClient />
    </PageContainer>
  );
}

