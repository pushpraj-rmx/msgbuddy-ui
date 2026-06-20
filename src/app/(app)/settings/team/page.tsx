import { redirect } from "next/navigation";

// Team Members is now an inline section of /settings. Preserve any existing
// deep links by redirecting to the consolidated page.
export default function SettingsTeamRedirect() {
  redirect("/settings#team-members");
}
