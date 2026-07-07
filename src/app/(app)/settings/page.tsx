import { redirect } from "next/navigation";

// Settings is now a grouped, multi-page section (see settings/layout.tsx).
// The old single-scroll hub is gone — land on the first Account page.
export default function SettingsPage() {
  redirect("/settings/account");
}
