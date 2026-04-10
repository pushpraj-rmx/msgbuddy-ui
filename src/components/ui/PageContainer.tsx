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
      className={`flex min-h-0 flex-1 flex-col overflow-auto space-y-4 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
