import { FlowEditorClient } from "@/components/flows/FlowEditorClient";
import type { MeResponse } from "@/lib/api";
import { serverFetch } from "@/lib/server-fetch";
import { endpoints } from "@/lib/endpoints";
import { canAccessFlows } from "@/lib/workspace-access";

export default async function FlowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await serverFetch<MeResponse>(endpoints.auth.me);

  if (!canAccessFlows(String(me.role))) {
    return (
      <div className="p-6">
        <div
          role="alert"
          className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3"
        >
          <span className="op-label mb-1 block text-warning">permission denied</span>
          <p className="text-[0.8125rem] text-base-content">
            You don&apos;t have permission to edit flows.
          </p>
        </div>
      </div>
    );
  }

  return <FlowEditorClient flowId={id} />;
}
