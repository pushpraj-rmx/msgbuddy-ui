import Link from "next/link";
import {
  serverFetch,
  type MeResponse,
  type WorkspaceCloudApiConfigResponse,
} from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

async function getCloudApiSafe(
  workspaceId: string
): Promise<WorkspaceCloudApiConfigResponse | null> {
  try {
    return await serverFetch<WorkspaceCloudApiConfigResponse>(
      endpoints.workspaces.cloudApi(workspaceId)
    );
  } catch {
    return null;
  }
}

function isWhatsAppConnected(
  config: WorkspaceCloudApiConfigResponse | null
): boolean {
  return (
    config != null &&
    (config.status === "ACTIVE" || config.hasAccessToken === true)
  );
}

export default async function DashboardPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const cloudApiConfig = await getCloudApiSafe(me.workspace.id);
  const showConnectWhatsAppTodo = !isWhatsAppConnected(cloudApiConfig);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-base-content/60">
          Welcome back, {me.user?.email ?? "User"}.
        </p>
      </div>

      {showConnectWhatsAppTodo && (
        <Link
          href="/settings/integrations/whatsapp"
          className="card card-border bg-base-200 hover:bg-base-300 transition-colors block"
        >
          <div className="card-body flex-row items-center gap-4">
            <span className="text-2xl" aria-hidden>
              📋
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="card-title text-base">Connect WhatsApp / Meta</h2>
              <p className="text-sm text-base-content/70">
                Link your WhatsApp Business account to start messaging customers.
              </p>
            </div>
            <span className="text-base-content/50 shrink-0" aria-hidden>
              →
            </span>
          </div>
        </Link>
      )}
    </div>
  );
}
