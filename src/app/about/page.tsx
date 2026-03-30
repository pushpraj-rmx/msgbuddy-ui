import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default async function AboutPage() {
  return (
    <MarketingPageShell>
      <div className="space-y-8">
        <div className="space-y-3">
          <span className="badge badge-primary badge-outline">About</span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for teams that run on conversations
          </h1>
          <p className="max-w-3xl text-base-content/80">
            MsgBuddy helps operators, support teams, and marketers coordinate
            high-quality WhatsApp communication from a single workspace.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-box border border-base-300 bg-base-200 p-5">
            <p className="text-sm font-medium">Mission</p>
            <p className="mt-2 text-sm text-base-content/70">
              Make business messaging clear, reliable, and measurable.
            </p>
          </div>
          <div className="rounded-box border border-base-300 bg-base-200 p-5">
            <p className="text-sm font-medium">Approach</p>
            <p className="mt-2 text-sm text-base-content/70">
              Focus on practical workflows and operational visibility.
            </p>
          </div>
          <div className="rounded-box border border-base-300 bg-base-200 p-5">
            <p className="text-sm font-medium">Product</p>
            <p className="mt-2 text-sm text-base-content/70">
              Inbox, contacts, campaigns, templates, and analytics in one app.
            </p>
          </div>
        </div>
      </div>
    </MarketingPageShell>
  );
}
