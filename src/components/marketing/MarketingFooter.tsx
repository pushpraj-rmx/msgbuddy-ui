import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-base-300 bg-base-200">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <BrandLogo className="h-7 w-auto" />
            <p className="text-sm text-base-content/70">
              WhatsApp SaaS for inbox, contacts, and campaigns.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/features" className="link link-hover">
              Features
            </Link>
            <Link href="/pricing" className="link link-hover">
              Pricing
            </Link>
            <Link href="/about" className="link link-hover">
              About
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center">
          <p className="text-xs text-base-content/60">© {year} MsgBuddy</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <Link href="/terms" className="link link-hover">
              Terms
            </Link>
            <Link href="/privacy" className="link link-hover">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
