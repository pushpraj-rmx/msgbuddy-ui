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

function isWhatsAppConnected(config: WorkspaceCloudApiConfigResponse | null) {
  return config != null && (config.status === "ACTIVE" || config.hasAccessToken);
}

export default async function IntegrationsSettingsPage() {
  const me = await serverFetch<MeResponse>(endpoints.auth.me);
  const cloudApiConfig = await getCloudApiSafe(me.workspace.id);
  const connected = isWhatsAppConnected(cloudApiConfig);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-base-content/60">
          Manage external channel connections for this workspace.
        </p>
      </div>

      <Link
        href="/settings/integrations/whatsapp"
        className="card card-border bg-base-200 hover:bg-base-300 transition-colors block"
      >
        <div className="card-body">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <h2 className="card-title text-base">WhatsApp</h2>
              <p className="text-sm text-base-content/70">
                Connect and monitor your WhatsApp Business phone number.
              </p>
            </div>
            <span className={`badge ${connected ? "badge-success" : "badge-ghost"}`}>
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

