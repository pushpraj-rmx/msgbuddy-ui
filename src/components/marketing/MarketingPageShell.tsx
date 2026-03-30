import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

type MarketingPageShellProps = {
  children: ReactNode;
};

export async function MarketingPageShell({ children }: MarketingPageShellProps) {
  return (
    <main className="min-h-screen bg-base-100 text-base-content">
      <MarketingHeader />
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {children}
      </section>
      <MarketingFooter />
    </main>
  );
}
