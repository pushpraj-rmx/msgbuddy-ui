import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicyShell, ContactBlock } from "../PolicyShell";
import { policyFor } from "../merchant-policies";
import Body from "./body";

export const metadata: Metadata = { title: "Contact Us" };

export default async function Page({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const merchant = policyFor(handle);
  if (!merchant) notFound();
  return (
    <PolicyShell handle={handle} merchant={merchant} title="Contact Us">
      <Body merchant={merchant} ContactBlock={ContactBlock} />
    </PolicyShell>
  );
}
