"use client";

import { useState } from "react";
import { integrationsApi } from "@/lib/api";

function getErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || "Failed to setup Email integration.";
}

export function EmailSetupPanel({ onDone }: { onDone: () => void }) {
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(
      { host: "", port: 587, username: "", password: "", fromEmail: "" },
      null,
      2
    )
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      await integrationsApi.setupEmail(payload);
      onDone();
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-200 p-4 space-y-2">
      <h3 className="text-sm font-semibold">Email setup</h3>
      <textarea
        className="textarea textarea-bordered w-full min-h-28 font-mono text-xs"
        value={payloadText}
        onChange={(e) => setPayloadText(e.target.value)}
      />
      {error ? (
        <div role="alert" className="alert alert-error alert-soft py-2 text-sm">
          {error}
        </div>
      ) : null}
      <button type="button" className="btn btn-sm btn-primary" onClick={submit} disabled={busy}>
        {busy ? "Saving…" : "Setup Email"}
      </button>
    </div>
  );
}

