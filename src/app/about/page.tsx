import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default async function AboutPage() {
  return (
    <MarketingPageShell>
      <div className="space-y-10 py-10">
        <div className="space-y-4">
          <span className="op-section-title">About</span>
          <h1 className="text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.75rem]">
            Built for teams that run on conversations
          </h1>
          <p className="max-w-3xl text-[0.9375rem] text-base-content/70">
            MsgBuddy helps operators, support teams, and marketers coordinate
            high-quality WhatsApp communication from a single workspace.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { label: "Mission",  body: "Make business messaging clear, reliable, and measurable." },
            { label: "Approach", body: "Focus on practical workflows and operational visibility." },
            { label: "Product",  body: "Inbox, contacts, campaigns, templates, and analytics in one app." },
          ].map((item) => (
            <div key={item.label} className="op-grain relative rounded-box border border-base-300 bg-base-200 p-6">
              <span className="op-label">{item.label}</span>
              <p className="mt-3 text-[0.875rem] leading-relaxed text-base-content/75">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </MarketingPageShell>
  );
}
