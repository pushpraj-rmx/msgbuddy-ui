import Link from "next/link";
import { policyFor } from "./merchant-policies";

const LINKS = [
  ["terms", "Terms"],
  ["privacy", "Privacy"],
  ["refund", "Refunds"],
  ["shipping", "Delivery"],
  ["contact", "Contact"],
] as const;

/**
 * Policy links for the storefront. Rendered on the server so they exist in the
 * initial HTML — a payment gateway reviewing the site (and any crawler) needs to
 * find them without running JS or waiting on the catalog request.
 */
export function PolicyFooter({ handle }: { handle: string }) {
  const merchant = policyFor(handle);
  if (!merchant) return null;
  return (
    <footer className="mt-8 border-t border-base-300 pt-5 text-center">
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
        {LINKS.map(([slug, label]) => (
          <Link
            key={slug}
            href={`/s/${handle}/policies/${slug}`}
            className="link link-hover text-base-content/55"
          >
            {label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-xs text-base-content/45">
        {merchant.legalName} · First delivery free within 7 km
      </p>
    </footer>
  );
}
