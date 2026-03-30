import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default async function FeaturesPage() {
  return (
    <MarketingPageShell>
      <div className="space-y-8">
        <div className="space-y-3">
          <span className="badge badge-primary badge-outline">Features</span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Core tools for WhatsApp operations
          </h1>
          <p className="max-w-3xl text-base-content/80">
            Everything in MsgBuddy is built to help operators respond faster,
            segment better, and run campaigns with confidence.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-box border border-base-300 bg-base-200 p-5">
            <h2 className="font-semibold">Unified inbox</h2>
            <p className="mt-2 text-sm text-base-content/70">
              Keep text and media replies in one flow with contact context.
            </p>
          </article>
          <article className="rounded-box border border-base-300 bg-base-200 p-5">
            <h2 className="font-semibold">Contact intelligence</h2>
            <p className="mt-2 text-sm text-base-content/70">
              Use segments and tags to target the right audience quickly.
            </p>
          </article>
          <article className="rounded-box border border-base-300 bg-base-200 p-5">
            <h2 className="font-semibold">Campaign control</h2>
            <p className="mt-2 text-sm text-base-content/70">
              Launch broadcasts and monitor outcomes from one dashboard.
            </p>
          </article>
          <article className="rounded-box border border-base-300 bg-base-200 p-5">
            <h2 className="font-semibold">Workspace-ready</h2>
            <p className="mt-2 text-sm text-base-content/70">
              Support team collaboration with workspace-aware organization.
            </p>
          </article>
        </div>
      </div>
    </MarketingPageShell>
  );
}
