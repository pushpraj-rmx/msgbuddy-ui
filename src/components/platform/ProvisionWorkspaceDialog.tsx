"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { platformApi } from "@/lib/api";

/**
 * SUPERADMIN: provision a workspace for an already-onboarded client who has
 * no account. Creates the workspace + a pinned-email invitation that hands
 * OWNERSHIP to the client when they register and accept. Shows the invite
 * link to copy/send — the client signs up through it.
 */
export function ProvisionWorkspaceDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [transferOwnership, setTransferOwnership] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    workspaceName: string;
    inviteUrl: string;
    email: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setTransferOwnership(true);
    setError(null);
    setResult(null);
    setCopied(false);
  };

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      setError("Workspace name and client email are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await platformApi.provisionWorkspace({
        name: name.trim(),
        clientEmail: email.trim(),
        transferOwnershipOnAccept: transferOwnership,
      });
      setResult({
        workspaceName: res.workspace.name,
        inviteUrl: `${window.location.origin}/accept-invite?token=${res.invitation.token}`,
        email: email.trim(),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to provision workspace.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the input below stays selectable
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        + Provision client workspace
      </button>

      {open ? (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-lg">
            {result ? (
              <>
                <h3 className="text-base font-semibold">
                  “{result.workspaceName}” is ready
                </h3>
                <p className="mt-2 text-sm text-base-content/70">
                  Send this invite link to <span className="font-medium">{result.email}</span>.
                  They&apos;ll create their account through it and{" "}
                  {transferOwnership
                    ? "automatically become the workspace OWNER (you drop to ADMIN)."
                    : "join with the invited role."}
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    readOnly
                    className="input input-bordered input-sm flex-1 font-mono text-xs"
                    value={result.inviteUrl}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button type="button" className="btn btn-sm" onClick={() => void copy()}>
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-base-content/50">
                  Link expires in 14 days. You can now connect the client&apos;s
                  WhatsApp number to this workspace (Channels → reassign, or run
                  Embedded Signup while switched into it).
                </p>
                <div className="modal-action">
                  <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold">Provision client workspace</h3>
                <p className="mt-1 text-xs text-base-content/60">
                  For a client who was onboarded (e.g. via Embedded Signup) but has no
                  account yet. Creates their workspace and an invite that makes them the
                  owner when they sign up.
                </p>
                {error ? (
                  <div className="mt-3 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
                    {error}
                  </div>
                ) : null}
                <div className="mt-4 space-y-3">
                  <label className="form-control">
                    <span className="label-text text-xs">Workspace name</span>
                    <input
                      className="input input-bordered input-sm"
                      placeholder="Acme Retail"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs">Client email</span>
                    <input
                      type="email"
                      className="input input-bordered input-sm"
                      placeholder="owner@acme.example"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm"
                      checked={transferOwnership}
                      onChange={(e) => setTransferOwnership(e.target.checked)}
                    />
                    <span className="text-sm">
                      Transfer ownership to the client on accept
                    </span>
                  </label>
                </div>
                <div className="modal-action">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void submit()}
                    disabled={busy}
                  >
                    {busy ? <span className="loading loading-spinner loading-xs" /> : null}
                    Create workspace & invite
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="modal-backdrop" onClick={() => (busy ? null : setOpen(false))} />
        </dialog>
      ) : null}
    </>
  );
}
