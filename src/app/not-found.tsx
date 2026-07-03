import Link from "next/link";
import { BrandIcon } from "@/components/BrandIcon";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <BrandIcon expression="error" className="h-16 w-16" title="MsgBuddy" />
      <div>
        <p className="op-label mb-1">error 404</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Page not found</h1>
        <p className="mt-1.5 max-w-sm text-sm text-base-content/60">
          The page you’re looking for doesn’t exist or has moved.
        </p>
      </div>
      <Link href="/dashboard" className="btn btn-primary btn-sm">
        Back to dashboard
      </Link>
    </div>
  );
}
