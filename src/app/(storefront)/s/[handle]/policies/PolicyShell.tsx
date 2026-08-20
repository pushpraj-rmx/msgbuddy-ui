import Link from "next/link";
import type { ReactNode } from "react";
import type { MerchantPolicy } from "./merchant-policies";

const PAGES = [
  { slug: "terms", label: "Terms" },
  { slug: "privacy", label: "Privacy" },
  { slug: "refund", label: "Refunds" },
  { slug: "shipping", label: "Delivery" },
  { slug: "contact", label: "Contact" },
] as const;

export function PolicyShell({
  handle,
  merchant,
  title,
  children,
}: {
  handle: string;
  merchant: MerchantPolicy;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="pb-10">
      <Link
        href={`/s/${handle}`}
        className="link link-hover text-sm text-base-content/60"
      >
        ← Back to {merchant.brandName}
      </Link>

      <h1 className="mt-4 font-serif text-3xl leading-tight tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-base-content/60">
        {merchant.legalName} · Last updated {merchant.updated}
      </p>

      <div className="prose prose-sm mt-6 max-w-none text-base-content/85 prose-headings:font-semibold prose-headings:text-base-content prose-strong:text-base-content">
        {children}
      </div>

      <nav className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-base-300 pt-5 text-sm">
        {PAGES.map((p) => (
          <Link
            key={p.slug}
            href={`/s/${handle}/policies/${p.slug}`}
            className="link link-hover text-base-content/60"
          >
            {p.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Address / contact block reused across pages — reviewers look for this. */
export function ContactBlock({ merchant }: { merchant: MerchantPolicy }) {
  return (
    <address className="not-italic">
      <strong>{merchant.legalName}</strong>
      {merchant.proprietor && <> (Proprietor: {merchant.proprietor})</>}
      <br />
      {merchant.address}
      <br />
      Email: <a href={`mailto:${merchant.email}`}>{merchant.email}</a>
      <br />
      Phone: <a href={`tel:${merchant.phone.replace(/\s/g, "")}`}>{merchant.phone}</a>
      {merchant.fssai && (
        <>
          <br />
          FSSAI Licence No.: {merchant.fssai}
        </>
      )}
      {merchant.gstin && (
        <>
          <br />
          GSTIN: {merchant.gstin}
        </>
      )}
    </address>
  );
}
