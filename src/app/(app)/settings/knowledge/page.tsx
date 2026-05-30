import Link from "next/link";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { KnowledgeClient } from "@/components/knowledge/KnowledgeClient";
import type { MeResponse, KnowledgeDoc } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

export default async function KnowledgePage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const canManage = roleHasWorkspacePermission(
    String(me.role),
    "settings.manage",
  );

  const initial = await serverFetch<KnowledgeDoc[]>(
    endpoints.knowledge.list,
  ).catch(() => [] as KnowledgeDoc[]);

  return (
    <PageContainer>
      <div className="mb-2">
        <Link href="/settings" className="btn btn-ghost btn-sm gap-1">
          ← Settings
        </Link>
      </div>
      <PageHeader
        title="Knowledge base"
        description="Docs the AI chatbot retrieves from to ground its replies. Each doc is chunked and embedded for semantic search."
      />
      <KnowledgeClient initial={initial} canManage={canManage} />
    </PageContainer>
  );
}
