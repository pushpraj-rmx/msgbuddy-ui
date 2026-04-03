"use client";

import { useEffect, useState } from "react";
import { integrationsApi, type IntegrationRecord } from "@/lib/api";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { TelegramSetupPanel } from "@/components/integrations/TelegramSetupPanel";
import { EmailSetupPanel } from "@/components/integrations/EmailSetupPanel";
import { SmsSetupPanel } from "@/components/integrations/SmsSetupPanel";

function getErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || "Something went wrong.";
}

export function IntegrationsSettingsClient({
  whatsappConnected,
}: {
  whatsappConnected: boolean;
}) {
  const [rows, setRows] = useState<IntegrationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await integrationsApi.list();
      setRows(data ?? []);
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const withBusy = async (id: string, work: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await work();
      await refresh();
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <IntegrationCard
        name="WhatsApp"
        description="Connect and monitor your WhatsApp Business phone number."
        status={whatsappConnected ? "connected" : "disconnected"}
        actionLabel={whatsappConnected ? "Manage" : "Connect"}
        href="/settings/integrations/whatsapp"
      />

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <TelegramSetupPanel onDone={refresh} />
        <EmailSetupPanel onDone={refresh} />
        <SmsSetupPanel onDone={refresh} />
      </div>

      <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Existing integrations</h2>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => void refresh()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <span className="loading loading-spinner loading-sm" />
        ) : rows.length ? (
          <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Default</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.channel}</td>
                    <td>{row.status || (row.isActive ? "ACTIVE" : "INACTIVE")}</td>
                    <td>{row.isDefault ? "Yes" : "No"}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => withBusy(row.id, () => integrationsApi.setDefault(row.id).then(() => {}))}
                          disabled={busyId === row.id}
                        >
                          Set default
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() =>
                            withBusy(row.id, () =>
                              (row.isActive
                                ? integrationsApi.deactivate(row.id)
                                : integrationsApi.activate(row.id)
                              ).then(() => {})
                            )
                          }
                          disabled={busyId === row.id}
                        >
                          {row.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() =>
                            withBusy(row.id, () => integrationsApi.remove(row.id).then(() => {}))
                          }
                          disabled={busyId === row.id}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-base-content/60">No integrations configured yet.</p>
        )}
      </div>
    </div>
  );
}

