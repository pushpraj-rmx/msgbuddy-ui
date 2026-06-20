import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individuals exploring the platform.",
    features: [
      "500 messages/mo",
      "100 contacts",
      "1 team member",
      "1 phone number",
      "256 MB storage",
      "WhatsApp channel",
    ],
    cta: "Start free",
    ctaHref: "/register",
  },
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "For small teams getting started with messaging.",
    features: [
      "10,000 messages/mo",
      "2,000 contacts",
      "5 team members",
      "2 phone numbers",
      "2 GB storage",
      "All channels",
      "Campaign support",
      "Basic analytics",
    ],
    cta: "Start 14-day trial",
    ctaHref: "/register",
  },
  {
    name: "Growth",
    price: "$79",
    period: "/month",
    description: "For growing teams that need more power.",
    highlighted: true,
    features: [
      "50,000 messages/mo",
      "10,000 contacts",
      "15 team members",
      "5 phone numbers",
      "10 GB storage",
      "All channels",
      "Campaign support",
      "Advanced analytics",
      "Priority support",
      "Template management",
    ],
    cta: "Start 14-day trial",
    ctaHref: "/register",
  },
  {
    name: "Scale",
    price: "Custom",
    period: "",
    description: "For enterprises with high-volume needs.",
    features: [
      "Unlimited messages",
      "50,000+ contacts",
      "50+ team members",
      "20+ phone numbers",
      "50 GB+ storage",
      "All channels",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "Custom onboarding",
    ],
    cta: "Contact sales",
    ctaHref: "mailto:sales@msgbuddy.com",
  },
];

export default async function PricingPage() {
  return (
    <MarketingPageShell>
      <div className="space-y-12 py-10">
        <div className="flex flex-col gap-4 text-center">
          <span className="op-section-title mx-auto">Pricing</span>
          <h1 className="text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.75rem]">
            Simple plans for growing teams
          </h1>
          <p className="mx-auto max-w-2xl text-[0.9375rem] text-base-content/70">
            Start with a 14-day free trial of our Growth plan. No credit card
            required. Scale your messaging as your team grows.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className={`op-grain relative flex flex-col rounded-box border bg-base-200 ${
                plan.highlighted ? "border-primary" : "border-base-300"
              }`}
            >
              <div className="flex flex-col gap-4 p-5">
                <div className="flex items-center justify-between">
                  <span className="op-label">{plan.name.toLowerCase()}</span>
                  {plan.highlighted ? (
                    <span className="op-tag op-tag-ok">popular</span>
                  ) : null}
                </div>
                <div>
                  <p className="font-mono-op text-[1.75rem] font-semibold leading-none tabular-nums">
                    {plan.price}
                    {plan.period ? (
                      <span className="ml-1 text-[0.8125rem] font-normal text-base-content/55">
                        {plan.period}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-2 text-[0.8125rem] text-base-content/60">
                    {plan.description}
                  </p>
                </div>

                <ul className="flex flex-col gap-1.5 border-t border-base-300 pt-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[0.8125rem] text-base-content/80">
                      <svg
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2">
                  {plan.ctaHref.startsWith("mailto:") ? (
                    <a href={plan.ctaHref} className="btn btn-sm w-full">
                      {plan.cta} →
                    </a>
                  ) : (
                    <Link
                      href={plan.ctaHref}
                      className={`btn btn-sm w-full ${plan.highlighted ? "btn-primary" : ""}`}
                    >
                      {plan.cta} →
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="text-center font-mono-op text-[0.6875rem] tracking-[0.04em] text-base-content/55">
          all paid plans include a 14-day free trial of the growth tier · no credit card required
        </div>
      </div>
    </MarketingPageShell>
  );
}
