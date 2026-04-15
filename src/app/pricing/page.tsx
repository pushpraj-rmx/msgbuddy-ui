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
      <div className="space-y-8">
        <div className="space-y-3 text-center">
          <span className="badge badge-primary badge-outline">Pricing</span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple plans for growing teams
          </h1>
          <p className="mx-auto max-w-2xl text-base-content/80">
            Start with a 14-day free trial of our Growth plan. No credit card
            required. Scale your messaging as your team grows.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className={`card card-border bg-base-200 ${
                plan.highlighted ? "border-primary ring-2 ring-primary/20" : ""
              }`}
            >
              <div className="card-body">
                <div className="flex items-center gap-2">
                  <h2 className="card-title">{plan.name}</h2>
                  {plan.highlighted ? (
                    <span className="badge badge-primary badge-sm">
                      Popular
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-base-content/60">
                  {plan.description}
                </p>
                <p className="mt-2">
                  <span className="text-3xl font-semibold">{plan.price}</span>
                  {plan.period ? (
                    <span className="text-sm text-base-content/70">
                      {plan.period}
                    </span>
                  ) : null}
                </p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-base-content/80"
                    >
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-success"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="card-actions mt-6">
                  {plan.ctaHref.startsWith("mailto:") ? (
                    <a
                      href={plan.ctaHref}
                      className="btn btn-ghost btn-sm w-full"
                    >
                      {plan.cta}
                    </a>
                  ) : (
                    <Link
                      href={plan.ctaHref}
                      className={`btn btn-sm w-full ${
                        plan.highlighted ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="text-center text-sm text-base-content/60">
          All paid plans include a 14-day free trial of the Growth tier. No
          credit card required.
        </div>
      </div>
    </MarketingPageShell>
  );
}
