export function AccessDenied({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-base-content/60">
          You do not have the required platform permissions for this section.
        </p>
      </div>
      <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3">
        <span>Access denied (403).</span>
      </div>
    </div>
  );
}
