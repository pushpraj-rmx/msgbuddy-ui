import type { ReactNode } from "react";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="rounded-xl border border-base-300/70 bg-base-100 p-4">
      <div className="flex items-center gap-2 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function EmptyState({
  title = "No data",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-base-300/70 bg-base-100 p-4 space-y-2">
      <p className="text-sm font-medium text-base-content">{title}</p>
      {description ? (
        <p className="text-xs text-base-content/60">{description}</p>
      ) : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-error/30 bg-error/10 p-4 space-y-2">
      <p className="text-sm font-medium text-error">{message}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

