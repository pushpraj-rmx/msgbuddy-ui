import type { ReactNode } from "react";

export function Section({ children }: { children: ReactNode }) {
  return <section className="space-y-3">{children}</section>;
}

