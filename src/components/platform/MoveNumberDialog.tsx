"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { platformApi } from "@/lib/api";
import type { PlatformChannelAccount } from "@/lib/types";

type WorkspaceOption = { id: string; name?: string; slug?: string };

/**
 * SUPERADMIN: move a connected WhatsApp number (CloudApiAccount + its
 * ChannelAccounts) to another workspace — e.g. into a freshly provisioned
 * client workspace. Inbound webhook routing follows immediately; existing
 * conversations/messages stay in the source workspace (guarded — moving a
 * number with traffic requires an explicit confirmation).
 */
export function MoveNumberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<PlatformChannelAccount[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [accountId, setAccountId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [force, setForce] = useState(false);
  const [needsForce, setNeedsForce] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [accs, ws] = await Promise.all([
          platformApi.listChannelAccounts(),
          platformApi.listWorkspaces({ limit: 200 } as never),
        ]);
        if (cancelled) return;
        setAccounts(
          accs.filter(
            (a) => (a.channel ?? "WHATSAPP") === "WHATSAPP" && a.cloudApiAccountId,
          ),
        );
        const items = (ws as { items?: WorkspaceOption[] }).items ?? [];
        setWorkspaces(items);
      } catch {
        if (!cancelled) setError("Couldn't load accounts/workspaces.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selected = accounts.find((a) => a.id === accountId);

  const submit = async () => {
    if (!selected?.cloudApiAccountId || !targetId) {
      setError("Pick a number and a target workspace.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await platformApi.reassignCloudApiAccount(
        String(selected.cloudApiAccountId),
        { targetWorkspaceId: targetId, force },
      );
      const target = workspaces.find((w) => w.id === targetId);
      setDone(
        `Moved to “${target?.name ?? targetId}” (${res.channelAccountsMoved} channel account${res.channelAccountsMoved === 1 ? "" : "s"}). ` +
          (res.leftBehind.conversationCount || res.leftBehind.messageCount
            ? `${res.leftBehind.conversationCount} conversations / ${res.leftBehind.messageCount} messages stayed in the source workspace.`
            : "No traffic was left behind."),
      );
      setNeedsForce(null);
      router.refresh();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (e instanceof Error ? e.message : "Move failed.");
      if (/force=true/i.test(String(msg))) {
        setNeedsForce(String(msg));
      } else {
        setError(String(msg));
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setAccountId("");
    setTargetId("");
    setForce(false);
    setNeedsForce(null);
    setError(null);
    setDone(null);
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
        ⇄ Move number between workspaces
      </button>

      {open ? (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="text-base font-semibold">Move a connected number</h3>
            <p className="mt-1 text-xs text-base-content/60">
              Moves the WhatsApp credential and its channel accounts — inbound
              messages route to the new workspace immediately. Conversation
              history stays where it is.
            </p>

            {done ? (
              <>
                <div className="mt-3 rounded-box border border-success/30 bg-success/5 px-3 py-2 text-sm">
                  {done}
                </div>
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
                    <span className="label-text text-xs">Number</span>
                    <select
                      className="select select-bordered select-sm"
                      value={accountId}
                      onChange={(e) => {
                        setAccountId(e.target.value);
                        setNeedsForce(null);
                        setForce(false);
                      }}
                    >
                      <option value="">Select a connected number…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {String(a.externalRef ?? a.externalId ?? a.id)} — currently:{" "}
                          {a.workspace?.name ?? "unassigned"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs">Target workspace</span>
                    <select
                      className="select select-bordered select-sm"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                    >
                      <option value="">Select a workspace…</option>
                      {workspaces
                        .filter((w) => w.id !== selected?.workspaceId)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name ?? w.slug ?? w.id}
                          </option>
                        ))}
                    </select>
                  </label>
                  {needsForce ? (
                    <div className="rounded-box border border-warning/40 bg-warning/5 px-3 py-2">
                      <p className="text-xs">{needsForce}</p>
                      <label className="mt-2 flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-warning checkbox-sm"
                          checked={force}
                          onChange={(e) => setForce(e.target.checked)}
                        />
                        <span className="text-xs font-medium">
                          I understand — move it anyway
                        </span>
                      </label>
                    </div>
                  ) : null}
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
                    disabled={busy || (needsForce !== null && !force)}
                  >
                    {busy ? <span className="loading loading-spinner loading-xs" /> : null}
                    Move number
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
