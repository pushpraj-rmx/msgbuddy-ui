import type { ReactNode } from "react";

/**
 * Operator page header — sr-only title for accessibility + optional visible action slot.
 * Page titles are shown in the Topbar breadcrumb, not duplicated on the page.
 */
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
  return (
    <>
      <div className="sr-only">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? (
        <div className={`flex items-center justify-end gap-2 ${className}`.trim()}>
          {actions}
        </div>
      ) : null}
    </>
  );
}
