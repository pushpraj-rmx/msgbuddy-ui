import type { ReactNode } from "react";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-box border border-base-300 bg-base-100 px-4 py-3 text-sm text-base-content/60">
      <span className="loading loading-spinner loading-sm shrink-0" />
      <span>{label}</span>
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
    <div className="flex flex-col items-center justify-center rounded-box border border-dashed border-base-300 bg-base-100 px-6 py-10 text-center">
      <p className="text-sm font-medium text-base-content">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-base-content/55">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
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
    <div className="rounded-box border border-error/30 bg-error/8 px-4 py-3">
      <p className="text-sm font-medium text-error">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
