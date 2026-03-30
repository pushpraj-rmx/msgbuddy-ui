import type { ReactNode } from "react";

export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`space-y-1 px-1 py-1 sm:space-y-1 sm:p-1 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
