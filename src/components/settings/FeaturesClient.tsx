"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShoppingBag } from "lucide-react";
import { type UpdateWorkspaceDto, workspaceApi } from "@/lib/api";

type FeatureKey = "commerceEnabled" | "recurringEnabled";

export function FeaturesClient({
  workspaceId,
  commerceEnabled,
  recurringEnabled,
}: {
  workspaceId: string;
  commerceEnabled: boolean;
  recurringEnabled: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ commerceEnabled, recurringEnabled });
  const [savingKey, setSavingKey] = useState<FeatureKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (key: FeatureKey, next: boolean) => {
    setSavingKey(key);
    setError(null);
    // Optimistic — revert on failure.
    setState((s) => ({ ...s, [key]: next }));
    try {
      const payload: UpdateWorkspaceDto = { [key]: next };
      await workspaceApi.updateWorkspace(workspaceId, payload);
      // Re-run server components so the sidebar nav reflects the change.
      router.refresh();
    } catch (e) {
      setState((s) => ({ ...s, [key]: !next }));
      setError(e instanceof Error ? e.message : "Failed to update feature");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="space-y-3">
      <span className="op-section-title">Optional modules</span>

      {error ? (
        <div
          role="alert"
          className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3"
        >
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem]">{error}</p>
        </div>
      ) : null}

      <div className="divide-y divide-base-300 rounded-box border border-base-300 bg-base-200">
        <FeatureRow
          Icon={ShoppingBag}
          title="Commerce"
          description="Mirror your Meta product catalogs to send Single- and Multi-Product messages over WhatsApp."
          checked={state.commerceEnabled}
          saving={savingKey === "commerceEnabled"}
          onChange={(next) => toggle("commerceEnabled", next)}
        />
        <FeatureRow
          Icon={RefreshCw}
          title="Subscriptions"
          description="Sell recurring prepaid deliveries with plans, wallets, cutoffs and a self-serve storefront."
          checked={state.recurringEnabled}
          saving={savingKey === "recurringEnabled"}
          onChange={(next) => toggle("recurringEnabled", next)}
        />
      </div>

      <p className="px-1 text-[0.75rem] text-base-content/50">
        Turning a module off hides it from the sidebar for everyone in this workspace. Your
        data is kept — turn it back on any time.
      </p>
    </section>
  );
}

function FeatureRow({
  Icon,
  title,
  description,
  checked,
  saving,
  onChange,
}: {
  Icon: typeof ShoppingBag;
  title: string;
  description: string;
  checked: boolean;
  saving: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 p-4 sm:p-5">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-base-content/45" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-[0.875rem] font-medium text-base-content">{title}</span>
        <p className="text-[0.78125rem] text-base-content/55">{description}</p>
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        {saving ? <span className="loading loading-spinner loading-xs" /> : null}
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm"
          checked={checked}
          disabled={saving}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    </label>
  );
}
