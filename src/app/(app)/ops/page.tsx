import { OpsClient } from "@/components/ops/OpsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

export default function OpsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Ops"
        description="Operational visibility for queues and upload sessions."
      />
      <OpsClient />
    </PageContainer>
  );
}

