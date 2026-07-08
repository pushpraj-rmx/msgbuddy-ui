import { redirect } from "next/navigation";

// Onboarding moved into the unified platform console. Keep this route as a
// redirect so old bookmarks/links resolve.
export default function OnboardingRedirectPage() {
  redirect("/platform/onboarding");
}
