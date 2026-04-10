import { FeedbackClient } from "@/components/feedback/FeedbackClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import type { MeResponse } from "@/lib/api";

export default async function FeedbackPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  return (
    <PageContainer className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 sm:px-6">
      <PageHeader
        title="Feedback"
        description="Report bugs or request features."
      />
      <FeedbackClient
        platformRole={me.platformRole}
        userId={me.user.id}
      />
    </PageContainer>
  );
}
