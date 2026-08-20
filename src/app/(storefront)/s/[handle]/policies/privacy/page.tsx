import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicyShell, ContactBlock } from "../PolicyShell";
import { policyFor } from "../merchant-policies";
import Body from "./body";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function Page({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const merchant = policyFor(handle);
  if (!merchant) notFound();
  return (
    <PolicyShell handle={handle} merchant={merchant} title="Privacy Policy">
      <Body merchant={merchant} ContactBlock={ContactBlock} />
    </PolicyShell>
  );
}
