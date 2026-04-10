"use client";

import { useClientWabas, useOwnedWabas } from "@/hooks/use-onboarding";
import { getApiError } from "@/lib/api-error";

function isMetaTokenMissingError(err: unknown): boolean {
  const message = getApiError(err);
  return message.includes("META_SYSTEM_ACCESS_TOKEN is not configured");
}

export function OnboardingWabaClient() {
  const owned = useOwnedWabas();
  const client = useClientWabas();

  const tokenMissing = isMetaTokenMissingError(owned.error) || isMetaTokenMissingError(client.error);

  if (tokenMissing) {
    return (
      <div role="alert" className="alert alert-error">
        <span>
          META_SYSTEM_ACCESS_TOKEN is not configured. Ask an administrator to configure
          Meta system token before using onboarding discovery.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {owned.error && (
        <div role="alert" className="alert alert-error">
          <span>{getApiError(owned.error)}</span>
        </div>
      )}
      {client.error && (
        <div role="alert" className="alert alert-error">
          <span>{getApiError(client.error)}</span>
        </div>
      )}

      <WabaSection
        title="Owned WABAs"
        description="WABAs owned by the system business."
        loading={owned.isLoading}
        count={owned.data?.count ?? 0}
        wabas={owned.data?.wabas ?? []}
      />
      <WabaSection
        title="Client-shared WABAs"
        description="WABAs shared by client businesses with current permissions/tasks."
        loading={client.isLoading}
        count={client.data?.count ?? 0}
        wabas={client.data?.wabas ?? []}
      />
    </div>
  );
}

function WabaSection({
  title,
  description,
  loading,
  count,
  wabas,
}: {
  title: string;
  description: string;
  loading: boolean;
  count: number;
  wabas: Array<{
    id: string;
    name: string;
    businessName?: string;
    accountReviewStatus?: string;
    isClientShared?: boolean;
    permissions?: string[];
    phoneNumbers: Array<{
      id: string;
      displayPhoneNumber: string;
      verifiedName: string;
      quality: string;
      status: string;
    }>;
  }>;
}) {
  return (
    <div className="card card-border bg-base-200">
      <div className="card-body space-y-3">
        <div>
          <h2 className="card-title text-base">{title}</h2>
          <p className="text-sm text-base-content/70">{description}</p>
          <p className="text-xs text-base-content/60">Count: {count}</p>
        </div>
        {loading && <span className="loading loading-spinner loading-sm" />}
        {!loading && !wabas.length && (
          <p className="text-sm text-base-content/60">No WABAs found.</p>
        )}
        {!!wabas.length && (
          <div className="grid gap-3 lg:grid-cols-2">
            {wabas.map((waba) => (
              <div key={waba.id} className="card card-border bg-base-100">
                <div className="card-body gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{waba.name}</h3>
                    <span className="badge badge-ghost">{waba.id}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>Business: {waba.businessName || "-"}</p>
                    <p>Review: {waba.accountReviewStatus || "-"}</p>
                    <p>Client shared: {waba.isClientShared ? "Yes" : "No"}</p>
                    <p>
                      Permissions:{" "}
                      {waba.permissions?.length ? waba.permissions.join(", ") : "-"}
                    </p>
                  </div>
                  <div className="divider my-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase text-base-content/70">
                      Phone numbers
                    </p>
                    {waba.phoneNumbers.length ? (
                      waba.phoneNumbers.map((phone) => (
                        <div
                          key={phone.id}
                          className="rounded-box border border-base-300 p-2 text-xs"
                        >
                          <p className="font-medium">{phone.displayPhoneNumber}</p>
                          <p>{phone.verifiedName}</p>
                          <p>
                            Quality: {phone.quality} | Status: {phone.status}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-base-content/60">
                        No phone numbers returned.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
