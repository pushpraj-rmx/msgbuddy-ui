"use client";

export function ReloadButton() {
  return (
    <button
      type="button"
      className="btn btn-sm btn-primary"
      onClick={() => window.location.reload()}
    >
      Retry
    </button>
  );
}
