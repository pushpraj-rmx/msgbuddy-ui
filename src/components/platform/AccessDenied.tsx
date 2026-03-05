export function AccessDenied({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-base-content/60">
          You do not have the required platform permissions for this section.
        </p>
      </div>
      <div role="alert" className="alert alert-warning">
        <span>Access denied (403).</span>
      </div>
    </div>
  );
}
