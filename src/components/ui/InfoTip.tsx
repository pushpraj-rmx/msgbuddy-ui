import { Info } from "lucide-react";

/**
 * Small (i) info icon with tooltip. Use next to labels that need explanation
 * for first-time users.
 *
 * Usage:
 * ```tsx
 * <span>Delivery rate <InfoTip tip="Delivered / sent × 100" /></span>
 * ```
 */
export function InfoTip({
  tip,
  position = "top",
  className,
}: {
  /** Tooltip text shown on hover. */
  tip: string;
  /** DaisyUI tooltip position. */
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <span
      className={`tooltip tooltip-${position} inline-flex cursor-help align-middle${className ? ` ${className}` : ""}`}
      data-tip={tip}
    >
      <Info className="h-3.5 w-3.5 text-base-content/40 hover:text-base-content/70 transition-colors" />
    </span>
  );
}
