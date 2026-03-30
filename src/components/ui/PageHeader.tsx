import type { ReactNode } from "react";

/** Primary page title for assistive tech; Topbar mirrors the label visually. */
export function PageHeader({
  title,
  description,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  if (!actions) {
    return (
      <div className={`sr-only ${className}`.trim()}>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-end gap-2 ${className}`.trim()}>
      <div className="sr-only">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
