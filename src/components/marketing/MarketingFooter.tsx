import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-base-300 bg-base-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col gap-2">
            <BrandLogo className="h-7 w-auto" />
            <p className="font-mono-op text-[0.6875rem] tracking-[0.04em] text-base-content/55">
              whatsapp saas · inbox · contacts · campaigns
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="op-label">navigate</span>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem]">
              <Link href="/features" className="text-base-content/70 hover:text-primary hover:underline underline-offset-4">Features</Link>
              <Link href="/pricing"  className="text-base-content/70 hover:text-primary hover:underline underline-offset-4">Pricing</Link>
              <Link href="/about"    className="text-base-content/70 hover:text-primary hover:underline underline-offset-4">About</Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center">
          <p className="font-mono-op text-[0.625rem] tracking-[0.08em] text-base-content/50">© {year} · MSGBUDDY</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[0.75rem]">
            <Link href="/terms"   className="text-base-content/60 hover:text-primary">Terms</Link>
            <Link href="/privacy" className="text-base-content/60 hover:text-primary">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
