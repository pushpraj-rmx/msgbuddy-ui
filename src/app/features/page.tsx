import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default async function FeaturesPage() {
  return (
    <MarketingPageShell>
      <div className="space-y-10 py-10">
        <div className="space-y-4">
          <span className="op-section-title">Features</span>
          <h1 className="text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.75rem]">
            Core tools for WhatsApp operations
          </h1>
          <p className="max-w-3xl text-[0.9375rem] text-base-content/70">
            Everything in MsgBuddy is built to help operators respond faster,
            segment better, and run campaigns with confidence.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {[
            { n: "01", label: "Unified inbox",        title: "Every conversation, one thread.",       desc: "Keep text and media replies in one flow with contact context." },
            { n: "02", label: "Contact intelligence", title: "Tags and segments that actually bite.", desc: "Use segments and tags to target the right audience quickly." },
            { n: "03", label: "Campaign control",     title: "Deliver, measure, iterate.",            desc: "Launch broadcasts and monitor outcomes from one dashboard." },
            { n: "04", label: "Workspace-ready",      title: "Built for teams, not solo inboxes.",    desc: "Support team collaboration with workspace-aware organization." },
          ].map((item) => (
            <article key={item.n} className="op-grain relative rounded-box border border-base-300 bg-base-200 p-6">
              <span className="op-label">{item.n} · {item.label}</span>
              <h2 className="mt-3 text-[1.0625rem] font-semibold tracking-[-0.015em]">{item.title}</h2>
              <p className="mt-1.5 text-[0.8125rem] text-base-content/60">{item.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </MarketingPageShell>
  );
}
