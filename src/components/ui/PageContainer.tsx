import type { ReactNode } from "react";

export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode; w
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-auto space-y-3 sm:space-y-3 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
