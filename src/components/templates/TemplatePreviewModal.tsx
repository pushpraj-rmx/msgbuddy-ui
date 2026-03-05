"use client";

import {
  useTemplateVersion,
  useLatestApprovedVersion,
} from "@/hooks/use-templates";
import type { Template, TemplateVersion } from "@/lib/types";

type Props = {
  template: Template | null;
  /** Specific version number, or null to show latest approved */
  version: number | null;
  onClose: () => void;
};

export function TemplatePreviewModal({
  template,
  version,
  onClose,
}: Props) {
  const byVersion = useTemplateVersion(
    template?.id ?? null,
    version != null && version > 0 ? version : null,
    { enabled: !!template?.id && version != null && version > 0 }
  );
  const latest = useLatestApprovedVersion(template?.id ?? null, {
    enabled: !!template?.id && (version == null || version <= 0),
  });
  const versionData = version != null && version > 0 ? byVersion.data : latest.data;
  const isLoading = version != null && version > 0 ? byVersion.isLoading : latest.isLoading;
  const error = version != null && version > 0 ? byVersion.error : latest.error;

  if (!template) return null;

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-md">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Template preview</h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-base-content/60 mt-1">
          {template.name} · {template.channel} · {template.category}
        </p>

        {isLoading && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md" />
          </div>
        )}
        {error && (
          <div role="alert" className="alert alert-error mt-4">
            <span>
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Failed to load version"}
            </span>
          </div>
        )}
        {!isLoading && !error && !versionData && (
          <p className="mt-4 text-base-content/60">
            No approved version to preview. Submit and approve a version first.
          </p>
        )}
        {versionData && (
          <TemplateVersionPreview version={versionData} />
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}

function TemplateVersionPreview({ version }: { version: TemplateVersion }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge badge-primary badge-sm">v{version.version}</span>
        <span
          className={`badge badge-sm ${
            version.status === "PROVIDER_APPROVED"
              ? "badge-success"
              : version.status === "APPROVED"
                ? "badge-info"
                : version.status === "REJECTED" ||
                    version.status === "PROVIDER_REJECTED"
                  ? "badge-error"
                  : version.status === "PENDING" ||
                      version.status === "PROVIDER_PENDING"
                    ? "badge-warning"
                    : "badge-ghost"
          }`}
        >
          {version.status}
        </span>
      </div>
      {"providerRejectionReason" in version &&
        version.providerRejectionReason && (
          <div
            role="alert"
            className="alert alert-error alert-soft text-sm py-2"
          >
            <span>{version.providerRejectionReason}</span>
          </div>
        )}
      {version.headerType !== "NONE" && version.headerContent && (
        <div className="rounded-lg bg-base-200 px-3 py-2 text-sm">
          <span className="text-base-content/60 text-xs uppercase">
            {version.headerType}
          </span>
          <p className="mt-1 wrap-break-word">{version.headerContent}</p>
        </div>
      )}
      <div className="rounded-lg bg-base-200 px-3 py-2 text-sm">
        <span className="text-base-content/60 text-xs uppercase">Body</span>
        <p className="mt-1 whitespace-pre-wrap wrap-break-word">{version.body}</p>
      </div>
      {version.footer && (
        <div className="rounded-lg bg-base-200 px-3 py-2 text-sm">
          <span className="text-base-content/60 text-xs uppercase">Footer</span>
          <p className="mt-1 wrap-break-word">{version.footer}</p>
        </div>
      )}
      {version.layoutType === "CAROUSEL" &&
        version.carouselCards &&
        version.carouselCards.length > 0 && (
          <div className="rounded-lg bg-base-200 px-3 py-2 text-sm">
            <span className="text-base-content/60 text-xs uppercase">
              Carousel ({version.carouselCards.length} cards)
            </span>
            <ul className="mt-1 list-disc list-inside space-y-1">
              {version.carouselCards.map((card, i) => (
                <li key={i} className="wrap-break-word">
                  {card.body || "—"}
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}
