"use client";

import Link from "next/link";

export function CampaignsAccessDenied({
  workspaceName,
}: {
  workspaceName: string;
}) {
  const subject = encodeURIComponent(
    `Campaign access request — ${workspaceName}`
  );
  const body = encodeURIComponent(
    `Hi,\n\nPlease grant me access to Campaigns in MsgBuddy for workspace "${workspaceName}".\n\nThanks!`
  );
  const mailto = `mailto:?subject=${subject}&body=${body}`;

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-box border border-base-300 bg-base-100 px-6 py-8 text-center">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-base-content">
          No access to campaigns
        </h2>
        <p className="text-sm text-base-content/70">
          Your role in this workspace doesn&apos;t include campaigns. Ask a workspace
          owner or admin to grant access, or use the options below.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <a href={mailto} className="btn btn-primary">
          Request access by email
        </a>
        <Link href="/settings#team-members" className="btn btn-outline">
          Open team settings
        </Link>
      </div>
    </div>
  );
}
