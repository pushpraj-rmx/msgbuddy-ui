import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicyShell, ContactBlock } from "../PolicyShell";
import { policyFor } from "../merchant-policies";
import Body from "./body";

export const metadata: Metadata = { title: "Terms of Service" };

export default async function Page({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const merchant = policyFor(handle);
  if (!merchant) notFound();
  return (
    <PolicyShell handle={handle} merchant={merchant} title="Terms of Service">
      <Body merchant={merchant} ContactBlock={ContactBlock} />
    </PolicyShell>
  );
}
