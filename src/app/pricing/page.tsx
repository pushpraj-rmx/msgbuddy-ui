import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default async function PricingPage() {
  return (
    <MarketingPageShell>
      <div className="space-y-8">
        <div className="space-y-3">
          <span className="badge badge-primary badge-outline">Pricing</span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple plans for growing teams
          </h1>
          <p className="max-w-3xl text-base-content/80">
            Start quickly and scale your messaging operations as volume grows.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="card card-border bg-base-200">
            <div className="card-body">
              <h2 className="card-title">Starter</h2>
              <p className="text-3xl font-semibold">$29</p>
              <p className="text-sm text-base-content/70">per workspace/month</p>
              <div className="card-actions mt-4">
                <Link href="/register" className="btn btn-ghost btn-sm">
                  Start free
                </Link>
              </div>
            </div>
          </article>
          <article className="card card-border border-primary bg-base-200">
            <div className="card-body">
              <h2 className="card-title">Growth</h2>
              <p className="text-3xl font-semibold">$79</p>
              <p className="text-sm text-base-content/70">per workspace/month</p>
              <div className="card-actions mt-4">
                <Link href="/register" className="btn btn-primary btn-sm">
                  Choose growth
                </Link>
              </div>
            </div>
          </article>
          <article className="card card-border bg-base-200">
            <div className="card-body">
              <h2 className="card-title">Scale</h2>
              <p className="text-3xl font-semibold">Custom</p>
              <p className="text-sm text-base-content/70">for larger operations</p>
              <div className="card-actions mt-4">
                <Link href="/register" className="btn btn-ghost btn-sm">
                  Contact sales
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </MarketingPageShell>
  );
}
