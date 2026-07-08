import { redirect } from "next/navigation";

// Ops moved into the unified platform console. Keep this route as a redirect
// so old bookmarks/links resolve.
export default function OpsRedirectPage() {
  redirect("/platform/ops");
}
