import Link from "next/link";

type IntegrationStatus = "connected" | "disconnected";

export function IntegrationCard({
  name,
  description,
  status,
  actionLabel,
  href,
}: {
  name: string;
  description: string;
  status: IntegrationStatus;
  actionLabel: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block card bg-base-100 border border-base-300 p-4 space-y-3 hover:bg-base-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-base font-medium text-base-content">{name}</h2>
          <p className="text-sm text-base-content/70">{description}</p>
        </div>
        <span className={status === "connected" ? "op-tag op-tag-ok" : "op-tag"}>
          {status === "connected" ? "Connected" : "Disconnected"}
        </span>
      </div>
      <div>
        <span className="btn btn-sm btn-outline">{actionLabel}</span>
      </div>
    </Link>
  );
}

