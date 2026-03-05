"use client";

import { useMemo, useState } from "react";
import { useLatestApprovedVersion } from "@/hooks/use-templates";
import { campaignsApi, contactsApi } from "@/lib/api";

export type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  templateId?: string;
  templateVersion?: number;
};

export type Template = {
  id: string;
  name: string;
  channel: string;
};

type Contact = {
  id: string;
  name?: string;
  phone: string;
};

type CampaignProgress = {
  progressPercent?: number;
  completedJobs?: number;
  totalJobs?: number;
  status?: string;
  runNumber?: number;
};

const AUDIENCE_TYPES = ["ALL", "CONTACTS", "QUERY"] as const;

function getApiError(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response
    ?.data?.message ?? "Something went wrong.";
}

export function CampaignsClient({
  initialCampaigns,
  templates,
}: {
  initialCampaigns: Campaign[];
  templates: Template[];
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCampaigns[0]?.id ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);

  const [step, setStep] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [audienceType, setAudienceType] =
    useState<(typeof AUDIENCE_TYPES)[number]>("ALL");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedId) ?? null,
    [campaigns, selectedId]
  );

  const { data: latestApproved, isLoading: latestApprovedLoading } =
    useLatestApprovedVersion(templateId, { enabled: !!templateId && wizardOpen });
  const canUseSelectedTemplate = !!latestApproved?.version;

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await campaignsApi.list()) as Campaign[];
      setCampaigns(data);
      setSelectedId((current) => current ?? data[0]?.id ?? null);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  const openWizard = async () => {
    setWizardOpen(true);
    setStep(1);
    setSelectedContacts([]);
    if (!contacts.length) {
      const data = await contactsApi.list({});
      setContacts(data.contacts ?? []);
    }
  };

  const createCampaign = async () => {
    if (!templateId || !latestApproved?.version) {
      setError("Template must be provider-approved before use in campaigns.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await campaignsApi.create({
        name: `Campaign ${new Date().toISOString()}`,
        channel: templates.find((tpl) => tpl.id === templateId)?.channel,
        templateId,
        templateVersion: latestApproved.version,
        audienceType,
        contactIds: audienceType === "CONTACTS" ? selectedContacts : undefined,
        scheduledAt: scheduledAt || undefined,
        timezone,
      });
      await refresh();
      setWizardOpen(false);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to create campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handleProgress = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    setError(null);
    try {
      const data = await campaignsApi.progress(selectedCampaign.id);
      setProgress(data);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to load progress.");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (
    action: "start" | "pause" | "resume" | "cancel"
  ) => {
    if (!selectedCampaign) return;
    setLoading(true);
    setError(null);
    try {
      if (action === "start") await campaignsApi.start(selectedCampaign.id);
      if (action === "pause") await campaignsApi.pause(selectedCampaign.id);
      if (action === "resume") await campaignsApi.resume(selectedCampaign.id);
      if (action === "cancel") await campaignsApi.cancel(selectedCampaign.id);
      await refresh();
      await handleProgress();
    } catch (err: unknown) {
      setError(getApiError(err) || "Campaign action failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-3">
          <div className="flex items-center justify-between">
            <h2 className="card-title text-lg">Campaigns</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={refresh}
            >
              Refresh
            </button>
          </div>
          {error && (
            <div role="alert" className="alert alert-error mt-2">
              <span>{error}</span>
            </div>
          )}
          <div className="mt-3 space-y-2">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left ${
                  campaign.id === selectedId
                    ? "border-primary bg-primary/10"
                    : "border-base-300 bg-base-100 hover:border-primary/40"
                }`}
                onClick={() => setSelectedId(campaign.id)}
              >
                <span className="font-medium">{campaign.name}</span>
                <span className="text-xs text-base-content/60">
                  {campaign.channel} · {campaign.status}
                </span>
              </button>
            ))}
          </div>
          {!campaigns.length && (
            <p className="mt-3 text-sm text-base-content/60">
              No campaigns yet.
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm mt-4 w-full"
            onClick={openWizard}
          >
            New campaign
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-lg">Campaign details</h2>
              {loading && <span className="loading loading-spinner" />}
            </div>
            {!selectedCampaign && (
              <p className="text-sm text-base-content/60">
                Select a campaign to view details.
              </p>
            )}
            {selectedCampaign && (
              <>
                <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                  <div className="text-sm text-base-content/60">Status</div>
                  <div className="text-lg font-semibold">
                    {selectedCampaign.status}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleAction("start")}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleAction("pause")}
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleAction("resume")}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleAction("cancel")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleProgress}
                  >
                    Refresh progress
                  </button>
                </div>
                {progress && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="stats bg-base-100 shadow-sm">
                      <div className="stat">
                        <div className="stat-title">Progress</div>
                        <div className="stat-value text-primary">
                          {progress.progressPercent || 0}%
                        </div>
                        <div className="stat-desc">
                          {progress.completedJobs || 0} of{" "}
                          {progress.totalJobs || 0} jobs
                        </div>
                      </div>
                    </div>
                    <div className="stats bg-base-100 shadow-sm">
                      <div className="stat">
                        <div className="stat-title">Status</div>
                        <div className="stat-value text-secondary">
                          {progress.status || "UNKNOWN"}
                        </div>
                        <div className="stat-desc">Run #{progress.runNumber}</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {wizardOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Create campaign</h3>
            <div className="mt-4 space-y-4">
              {step === 1 && (
                <div className="space-y-2">
                  <p className="text-sm text-base-content/60">
                    Step 1: Choose a template (provider-approved only)
                  </p>
                  <select
                    className="select select-bordered w-full"
                    value={templateId || ""}
                    onChange={(event) => setTemplateId(event.target.value || null)}
                  >
                    <option value="">Select a template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {templateId && latestApprovedLoading && (
                    <p className="text-sm text-base-content/60">
                      Checking approved version…
                    </p>
                  )}
                  {templateId && !latestApprovedLoading && !canUseSelectedTemplate && (
                    <div role="alert" className="alert alert-warning alert-soft text-sm">
                      <span>
                        This template has no provider-approved version. Approve
                        and sync a version in Templates first.
                      </span>
                    </div>
                  )}
                  {templateId && canUseSelectedTemplate && (
                    <p className="text-sm text-success">
                      Using version {latestApproved?.version} (provider-approved).
                    </p>
                  )}
                </div>
              )}
              {step === 2 && (
                <div className="space-y-2">
                  <p className="text-sm text-base-content/60">
                    Step 2: Choose an audience
                  </p>
                  <select
                    className="select select-bordered w-full"
                    value={audienceType}
                    onChange={(event) =>
                      setAudienceType(
                        event.target.value as (typeof AUDIENCE_TYPES)[number]
                      )
                    }
                  >
                    {AUDIENCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {audienceType === "CONTACTS" && (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-2">
                      {contacts.map((contact) => (
                        <label
                          key={contact.id}
                          className="flex items-center gap-2 py-1 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={(event) => {
                              setSelectedContacts((prev) =>
                                event.target.checked
                                  ? [...prev, contact.id]
                                  : prev.filter((id) => id !== contact.id)
                              );
                            }}
                          />
                          <span>
                            {contact.name || contact.phone} ({contact.phone})
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {step === 3 && (
                <div className="space-y-2">
                  <p className="text-sm text-base-content/60">
                    Step 3: Schedule
                  </p>
                  <input
                    type="datetime-local"
                    className="input input-bordered w-full"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    placeholder="Timezone (e.g. America/New_York)"
                  />
                </div>
              )}
            </div>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setWizardOpen(false)}
              >
                Cancel
              </button>
              {step > 1 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setStep((prev) => prev - 1)}
                >
                  Back
                </button>
              )}
              {step < 3 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setStep((prev) => prev + 1)}
                  disabled={
                    step === 1 &&
                    (!templateId || !canUseSelectedTemplate || latestApprovedLoading)
                  }
                >
                  Next
                </button>
              )}
              {step === 3 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={createCampaign}
                >
                  Create
                </button>
              )}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
