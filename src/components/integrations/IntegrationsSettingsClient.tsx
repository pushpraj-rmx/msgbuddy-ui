"use client";

import { useEffect, useState } from "react";
import { integrationsApi, type IntegrationRecord } from "@/lib/api";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { TelegramSetupPanel } from "@/components/integrations/TelegramSetupPanel";
import { EmailSetupPanel } from "@/components/integrations/EmailSetupPanel";
import { SmsSetupPanel } from "@/components/integrations/SmsSetupPanel";
import { LoadingState, EmptyState } from "@/components/ui/states";

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
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem] text-base-content">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <TelegramSetupPanel onDone={refresh} />
        <EmailSetupPanel onDone={refresh} />
        <SmsSetupPanel onDone={refresh} />
      </div>

      <div className="rounded-box border border-base-300 bg-base-200">
        <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Existing integrations</h2>
            <span className="op-label">connected channels</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void refresh()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="p-4">
            <LoadingState label="Loading integrations…" />
          </div>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[0.78125rem]">
              <thead>
                <tr className="border-b border-base-300 bg-base-100">
                  <th className="op-label px-3 py-2.5 text-left font-medium">Channel</th>
                  <th className="op-label px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="op-label px-3 py-2.5 text-left font-medium">Default</th>
                  <th className="op-label px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0">
                    <td className="px-3 py-3 font-medium">{row.channel}</td>
                    <td className="px-3 py-3">
                      <span className={row.isActive ? "op-tag op-tag-ok" : "op-tag"}>
                        {row.status || (row.isActive ? "ACTIVE" : "INACTIVE")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {row.isDefault ? <span className="op-tag op-tag-ok">Yes</span> : <span className="op-tag">No</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
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
          <div className="p-4">
            <EmptyState
              title="No integrations configured yet"
              description="Connect a channel above to start sending and receiving messages."
            />
          </div>
        )}
      </div>
    </div>
  );
}

