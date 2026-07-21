"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { platformApi } from "@/lib/api";

type WorkspaceOption = { id: string; name?: string; slug?: string };

/**
 * SUPERADMIN: connect a WhatsApp number that Embedded Signup won't list —
 * the WABA is shared with our Tech Provider business, but the ES picker
 * omits it. The backend verifies access with the server-held system token
 * (it never reaches the browser), creates the account, and subscribes our
 * app to the WABA for webhooks.
 */
export function ManualConnectNumberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    summary: string;
    subscribed: boolean;
    subscribeError: string | null;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const ws = await platformApi.listWorkspaces({ limit: 200 } as never);
        if (cancelled) return;
        setWorkspaces((ws as { items?: WorkspaceOption[] }).items ?? []);
      } catch {
        if (!cancelled) setError("Couldn't load workspaces.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const submit = async () => {
    if (!workspaceId || !wabaId.trim() || !phoneNumberId.trim()) {
      setError("Workspace, WABA ID and Phone Number ID are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await platformApi.manualConnectNumber({
        workspaceId,
        wabaId: wabaId.trim(),
        phoneNumberId: phoneNumberId.trim(),
        ...(businessId.trim() ? { businessId: businessId.trim() } : {}),
      });
      const target = workspaces.find((w) => w.id === workspaceId);
      setDone({
        summary: `${res.displayPhoneNumber ?? res.phoneNumberId}${res.verifiedName ? ` (“${res.verifiedName}”)` : ""} connected to “${target?.name ?? workspaceId}”${res.qualityRating ? ` · quality ${res.qualityRating}` : ""}${res.isDefault ? " · set as default sender" : ""}.`,
        subscribed: res.subscribed,
        subscribeError: res.subscribeError,
      });
      router.refresh();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? (e instanceof Error ? e.message : "Connect failed.");
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setWorkspaceId("");
    setWabaId("");
    setPhoneNumberId("");
    setBusinessId("");
    setError(null);
    setDone(null);
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        ⌁ Manually connect number
      </button>

      {open ? (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="text-base font-semibold">Manually connect a number</h3>
            <p className="mt-1 text-xs text-base-content/60">
              For numbers Embedded Signup won&apos;t list. The WABA must already be
              shared with your Tech Provider business (Business Manager → Partners).
              Access is verified with the server-held system token before anything
              is created.
            </p>

            {done ? (
              <>
                <div className="mt-3 rounded-box border border-success/30 bg-success/5 px-3 py-2 text-sm">
                  {done.summary}
                </div>
                {done.subscribed ? (
                  <p className="mt-2 text-xs text-base-content/60">
                    ✅ Webhooks subscribed — inbound messages will flow. If the
                    number was never registered for Cloud API, finish
                    registration from the workspace&apos;s WhatsApp settings.
                  </p>
                ) : (
                  <p className="mt-2 rounded-box border border-warning/40 bg-warning/5 px-3 py-2 text-xs">
                    ⚠️ Connected, but the webhook subscription failed
                    {done.subscribeError ? ` (${done.subscribeError})` : ""} —
                    retry it from the workspace via “Ensure subscription”, or
                    re-run this dialog.
                  </p>
                )}
                <div className="modal-action">
                  <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                {error ? (
                  <div className="mt-3 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
                    {error}
                  </div>
                ) : null}
                <div className="mt-4 space-y-3">
                  <label className="form-control">
                    <span className="label-text text-xs">Target workspace</span>
                    <select
                      className="select select-bordered select-sm"
                      value={workspaceId}
                      onChange={(e) => setWorkspaceId(e.target.value)}
                    >
                      <option value="">Select a workspace…</option>
                      {workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name ?? w.slug ?? w.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs">WABA ID</span>
                    <input
                      className="input input-bordered input-sm font-mono"
                      placeholder="580962941756825"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs">Phone Number ID</span>
                    <input
                      className="input input-bordered input-sm font-mono"
                      placeholder="572193699301704"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs">
                      Business ID <span className="text-base-content/40">(optional)</span>
                    </span>
                    <input
                      className="input input-bordered input-sm font-mono"
                      placeholder="1197846617229225"
                      value={businessId}
                      onChange={(e) => setBusinessId(e.target.value)}
                    />
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
                    Verify & connect
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
