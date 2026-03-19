"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type WorkspaceCloudApiConfigResponse,
  type WorkspaceSettingsPayload,
} from "@/lib/api";

export type Workspace = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  timezone?: string;
  locale?: string;
  status?: string;
};

export type WorkspaceSettings = Partial<WorkspaceSettingsPayload> & {
  timezone?: string;
  locale?: string;
};

export type Member = {
  id: string;
  role: string;
  user?: { email?: string };
};

const TABS = ["Workspace info", "Members", "Integrations"] as const;

function isWhatsAppConnected(config: WorkspaceCloudApiConfigResponse | null): boolean {
  return config != null && (config.status === "ACTIVE" || config.hasAccessToken === true);
}

export function SettingsClient({
  workspaceId,
  workspace,
  settings,
  members,
  cloudApiConfig,
}: {
  workspaceId: string;
  workspace: Workspace;
  settings: WorkspaceSettings;
  members: Member[];
  cloudApiConfig: WorkspaceCloudApiConfigResponse | null;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Workspace info");

  return (
    <div className="space-y-4">
      <div role="tablist" className="tabs tabs-box">
        {TABS.map((label) => (
          <button
            key={label}
            role="tab"
            className={`tab ${tab === label ? "tab-active" : ""}`}
            onClick={() => setTab(label)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "Workspace info" && (
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="Name" value={workspace.name} />
          <InfoCard label="Slug" value={workspace.slug} />
          <InfoCard label="Description" value={workspace.description} />
          <InfoCard label="Status" value={workspace.status} />
          <InfoCard
            label="Timezone"
            value={settings.timezone || workspace.timezone}
          />
          <InfoCard
            label="Locale"
            value={settings.locale || workspace.locale}
          />
        </div>
      )}

      {tab === "Members" && (
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.user?.email || "Unknown"}</td>
                  <td>{member.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!members.length && (
            <div className="p-4 text-sm text-base-content/60">
              No members found.
            </div>
          )}
        </div>
      )}

      {tab === "Integrations" && (
        <div className="space-y-4">
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
                <span
                  className={`badge ${
                    isWhatsAppConnected(cloudApiConfig)
                      ? "badge-success"
                      : "badge-ghost"
                  }`}
                >
                  {isWhatsAppConnected(cloudApiConfig) ? "Connected" : "Not connected"}
                </span>
              </div>
            </div>
          </Link>

          <Link href="/settings/integrations" className="link link-hover text-sm">
            View all integrations →
          </Link>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <div className="text-sm text-base-content/60">{label}</div>
        <div className="text-lg font-semibold">{value || "-"}</div>
      </div>
    </div>
  );
}
