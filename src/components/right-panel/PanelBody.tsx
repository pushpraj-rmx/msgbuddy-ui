import type { ReactNode } from "react";

/**
 * Operator standard layout wrapper for right-panel content.
 *
 * Provides consistent padding, border rhythm, and mono section labels.
 * Consumers replace ad-hoc div layouts with:
 *
 * ```tsx
 * <PanelBody>
 *   <PanelSection label="Contact info">...</PanelSection>
 *   <PanelSection label="Tags">...</PanelSection>
 * </PanelBody>
 * ```
 *
 * Loading state: render `<LoadingState>` as a child — the component
 * itself doesn't manage async states.
 */

export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

export function PanelSection({
  label,
  children,
  className,
  noBorder,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  /** Skip the bottom border (e.g. for the last section). */
  noBorder?: boolean;
}) {
  return (
    <div
      className={`px-4 py-3${noBorder ? "" : " border-b border-base-300"}${className ? ` ${className}` : ""}`}
    >
      {label ? (
        <div className="op-section-title mb-3">{label}</div>
      ) : null}
      {children}
    </div>
  );
}
