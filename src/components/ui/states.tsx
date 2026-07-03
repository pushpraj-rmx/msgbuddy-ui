import type { ReactNode } from "react";
import { BrandIcon } from "@/components/BrandIcon";
import { BrandLoader } from "@/components/BrandLoader";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-box border border-base-300 bg-base-200 px-4 py-3 text-[0.8125rem] text-base-content/65">
      <BrandLoader tone="current" title={label} className="h-5 w-5 shrink-0 text-primary" />
      <span className="font-mono-op tracking-[0.04em]">{label}</span>
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="op-grain relative flex flex-col items-center justify-center rounded-box border border-dashed border-base-300 bg-base-200 px-6 py-12 text-center">
      <BrandIcon expression="sleeping" tone="current" title="" className="mb-3 h-10 w-10 text-base-content/20" />
      <span className="op-label mb-2">no data</span>
      <p className="text-sm font-semibold text-base-content">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[0.75rem] text-base-content/55">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  suggestion,
  action,
}: {
  message: string;
  /** Optional next-step guidance for the user. */
  suggestion?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-box border-l-2 border border-error/30 border-l-error bg-base-200 px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        <BrandIcon expression="error" tone="current" title="" className="h-4 w-4 shrink-0 text-error" />
        <span className="op-label block text-error">error</span>
      </div>
      <p className="text-[0.8125rem] font-medium text-base-content">{message}</p>
      {suggestion ? (
        <p className="mt-1 text-[0.75rem] text-base-content/55">{suggestion}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
