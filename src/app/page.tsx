import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default async function HomePage() {
  return (
    <MarketingPageShell>
      <section className="flex min-h-[70vh] flex-col items-start justify-center gap-8">
        <span className="badge badge-primary badge-outline">MsgBuddy</span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Run WhatsApp conversations, campaigns, and support from one place.
        </h1>
        <p className="max-w-2xl text-base-content/80 sm:text-lg">
          MsgBuddy helps teams reply faster, organize contacts, and ship
          broadcast campaigns with visibility across every workspace.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/features" className="btn btn-primary">
            Explore features
          </Link>
          <Link href="/pricing" className="btn btn-ghost">
            View pricing
          </Link>
        </div>

        <div className="mt-4 grid w-full gap-3 sm:grid-cols-3">
          <div className="rounded-box border border-base-300 bg-base-200 p-4">
            <p className="text-sm font-medium">Unified Inbox</p>
            <p className="mt-1 text-sm text-base-content/70">
              Handle customer replies and media in a single thread view.
            </p>
          </div>
          <div className="rounded-box border border-base-300 bg-base-200 p-4">
            <p className="text-sm font-medium">Audience & Segments</p>
            <p className="mt-1 text-sm text-base-content/70">
              Organize contacts with tags and segments for better targeting.
            </p>
          </div>
          <div className="rounded-box border border-base-300 bg-base-200 p-4">
            <p className="text-sm font-medium">Campaign Delivery</p>
            <p className="mt-1 text-sm text-base-content/70">
              Track message outcomes and iterate on your outreach.
            </p>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
