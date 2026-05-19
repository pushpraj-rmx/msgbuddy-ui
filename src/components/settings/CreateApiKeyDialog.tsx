"use client";

import { useEffect, useRef, useState } from "react";
import {
  apiKeysApi,
  type CreatedApiKeyResponseDto,
} from "@/lib/api";

type Stage = "form" | "reveal";

function isoEndOfDayOrUndefined(date: string): string | undefined {
  if (!date) return undefined;
  // <input type="date"> gives `YYYY-MM-DD`. Expire at 23:59:59 of that day, UTC.
  const t = new Date(`${date}T23:59:59.000Z`);
  if (Number.isNaN(t.getTime())) return undefined;
  return t.toISOString();
}

export function CreateApiKeyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (key: CreatedApiKeyResponseDto) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("form");
  const [label, setLabel] = useState("");
  const [testKey, setTestKey] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reveal-stage state
  const [created, setCreated] = useState<CreatedApiKeyResponseDto | null>(null);
  const [copyStamp, setCopyStamp] = useState<string | null>(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  // Open/close + reset
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Defer focus so the dialog has rendered.
      setTimeout(() => labelRef.current?.focus(), 50);
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // When closed externally, reset everything for next open.
  useEffect(() => {
    if (open) return;
    setStage("form");
    setLabel("");
    setTestKey(false);
    setExpiry("");
    setSubmitting(false);
    setError(null);
    setCreated(null);
    setCopyStamp(null);
    setSavedConfirmed(false);
  }, [open]);

  // Force the reveal stage's only exit to be the Done button. Escape +
  // backdrop click never close stage=reveal — preserves "you must consciously
  // acknowledge you saved the key" even after the checkbox is ticked, because
  // the *next* event is onCreated firing in the parent.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      if (stage === "reveal") e.preventDefault();
    };
    const onCloseEvt = () => {
      // Native close fires only for stage=form (reveal stage's cancel was
      // preventDefaulted). Propagate to the parent.
      if (stage === "form") onClose();
    };
    el.addEventListener("cancel", onCancel);
    el.addEventListener("close", onCloseEvt);
    return () => {
      el.removeEventListener("cancel", onCancel);
      el.removeEventListener("close", onCloseEvt);
    };
  }, [stage, onClose]);

  const handleGenerate = async () => {
    if (!label.trim()) {
      setError("Give the key a label so you can identify it later.");
      labelRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        label: label.trim(),
        test: testKey,
        ...(expiry ? { expiresAt: isoEndOfDayOrUndefined(expiry) } : {}),
      };
      const result = await apiKeysApi.create(body);
      setCreated(result);
      setStage("reveal");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not generate the key. Try again or check your permissions.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.plaintextKey);
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setCopyStamp(`${hh}:${mm}:${ss}`);
      // Auto-revert after 4s so the affordance returns to "Copy".
      setTimeout(() => setCopyStamp(null), 4000);
    } catch {
      setError(
        "Clipboard unavailable. Select the key above and copy it manually.",
      );
    }
  };

  const handleDone = () => {
    if (!created || !savedConfirmed) return;
    onCreated(created);
    onClose();
  };

  return (
    <dialog ref={dialogRef} className="modal modal-middle">
      <div
        className="modal-box max-w-lg overflow-hidden"
        style={{
          animation: "op-panel-fade-in 160ms cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        {stage === "form" ? (
          <FormStage
            labelRef={labelRef}
            label={label}
            setLabel={setLabel}
            testKey={testKey}
            setTestKey={setTestKey}
            expiry={expiry}
            setExpiry={setExpiry}
            submitting={submitting}
            error={error}
            onCancel={onClose}
            onGenerate={() => void handleGenerate()}
          />
        ) : (
          <RevealStage
            secret={created?.plaintextKey ?? ""}
            prefix={created?.prefix ?? "mb_live"}
            label={created?.label ?? ""}
            copyStamp={copyStamp}
            savedConfirmed={savedConfirmed}
            setSavedConfirmed={setSavedConfirmed}
            error={error}
            onCopy={() => void handleCopy()}
            onDone={handleDone}
          />
        )}
      </div>
      {/* Backdrop click closes ONLY in stage=form. Stage=reveal has no backdrop form. */}
      {stage === "form" ? (
        <form method="dialog" className="modal-backdrop">
          <button type="submit" className="sr-only" aria-label="Close">
            close
          </button>
        </form>
      ) : (
        <div className="modal-backdrop bg-black/60" aria-hidden="true" />
      )}
    </dialog>
  );
}

function FormStage({
  labelRef,
  label,
  setLabel,
  testKey,
  setTestKey,
  expiry,
  setExpiry,
  submitting,
  error,
  onCancel,
  onGenerate,
}: {
  labelRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  setLabel: (v: string) => void;
  testKey: boolean;
  setTestKey: (v: boolean) => void;
  expiry: string;
  setExpiry: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onGenerate: () => void;
}) {
  return (
    <>
      <span className="op-label">generate api key</span>
      <h3 className="mt-1 text-[1.0625rem] font-semibold tracking-[-0.015em]">
        New API key
      </h3>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-base-content/60">
        Used by external apps to authenticate against the MsgBuddy API on
        behalf of this workspace.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="op-label mb-1.5 block" htmlFor="api-key-label">
            label
          </label>
          <input
            ref={labelRef}
            id="api-key-label"
            type="text"
            className="input input-bordered input-sm w-full"
            placeholder="e.g. ERP backend"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
            disabled={submitting}
          />
          <p className="mt-1 font-mono-op text-[0.6875rem] text-base-content/40">
            Shown in the keys list. Make it specific.
          </p>
        </div>

        <div>
          <label className="op-label mb-1.5 block">key type</label>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={testKey}
                onChange={(e) => setTestKey(e.target.checked)}
                disabled={submitting}
              />
              <span className="font-mono-op text-[0.8125rem] tabular-nums">
                {testKey ? "mb_test_" : "mb_live_"}
              </span>
            </label>
          </div>
          <p className="mt-1 font-mono-op text-[0.6875rem] text-base-content/40">
            Test keys behave identically to live keys today. Behaviour will
            diverge when sandbox mode ships.
          </p>
        </div>

        <div>
          <label className="op-label mb-1.5 block" htmlFor="api-key-expiry">
            expires
          </label>
          <input
            id="api-key-expiry"
            type="date"
            className="input input-bordered input-sm w-full font-mono-op"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            disabled={submitting}
            min={new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10)}
          />
          <p className="mt-1 font-mono-op text-[0.6875rem] text-base-content/40">
            Optional. Leave blank for no expiry.
          </p>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2.5"
        >
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem]">{error}</p>
        </div>
      ) : null}

      <div className="modal-action mt-6">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onGenerate}
          disabled={submitting}
        >
          {submitting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : null}
          Generate key
        </button>
      </div>
    </>
  );
}

function RevealStage({
  secret,
  prefix,
  label,
  copyStamp,
  savedConfirmed,
  setSavedConfirmed,
  error,
  onCopy,
  onDone,
}: {
  secret: string;
  prefix: "mb_live" | "mb_test";
  label: string;
  copyStamp: string | null;
  savedConfirmed: boolean;
  setSavedConfirmed: (v: boolean) => void;
  error: string | null;
  onCopy: () => void;
  onDone: () => void;
}) {
  return (
    <>
      <span className="op-label" style={{ color: "var(--op-accent)" }}>
        key generated
      </span>
      <h3
        className="mt-1 italic text-[1.25rem] leading-snug tracking-[-0.015em]"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Here is your key.
      </h3>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-base-content/60">
        <span className="font-mono-op text-base-content/80">{label}</span>{" "}
        <span className="text-base-content/40">·</span>{" "}
        <span className="font-mono-op text-base-content/40">{prefix}_</span>
      </p>

      {/* Secret-as-artifact card */}
      <div
        className="op-grain mt-5 flex items-center gap-3 rounded-box border border-base-300 bg-[var(--op-bg-2)] px-5 py-4"
        style={{
          animation:
            "op-panel-fade-in 200ms 60ms cubic-bezier(0.2, 0, 0, 1) backwards",
        }}
      >
        <code
          className="flex-1 select-all font-mono-op text-[1.0625rem] tabular-nums tracking-tight break-all text-base-content/95"
          aria-label="API key value"
        >
          {secret}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="btn btn-sm shrink-0 border-base-300 bg-base-100 font-mono-op text-[0.75rem] tracking-[0.04em] text-base-content hover:bg-[var(--op-bg-hover)]"
          style={{ minWidth: "11ch" }}
        >
          {copyStamp ? (
            <span style={{ color: "var(--op-accent)" }}>
              Copied {copyStamp}
            </span>
          ) : (
            <>Copy</>
          )}
        </button>
      </div>

      {/* Warning */}
      <div
        className="mt-4 rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3"
        style={{
          animation:
            "op-panel-fade-in 200ms 140ms cubic-bezier(0.2, 0, 0, 1) backwards",
        }}
      >
        <span className="op-label mb-1 block" style={{ color: "var(--op-warn)" }}>
          one-time view
        </span>
        <p className="text-[0.8125rem] leading-relaxed">
          This is the only time the full key is shown. Save it in your app&apos;s
          secret store before closing — MsgBuddy keeps only a hash and the last
          four characters.
        </p>
      </div>

      {/* Save confirmation */}
      <label
        className="mt-5 flex cursor-pointer items-start gap-3"
        style={{
          animation:
            "op-panel-fade-in 200ms 220ms cubic-bezier(0.2, 0, 0, 1) backwards",
        }}
      >
        <input
          type="checkbox"
          className="checkbox checkbox-sm mt-0.5"
          checked={savedConfirmed}
          onChange={(e) => setSavedConfirmed(e.target.checked)}
        />
        <span className="text-[0.8125rem] leading-relaxed">
          I&apos;ve saved this key in a secure place.
        </span>
      </label>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2.5"
        >
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem]">{error}</p>
        </div>
      ) : null}

      <div className="modal-action mt-6">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onDone}
          disabled={!savedConfirmed}
          style={{ opacity: savedConfirmed ? 1 : 0.4 }}
        >
          Done
        </button>
      </div>
    </>
  );
}
