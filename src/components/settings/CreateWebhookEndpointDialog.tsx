"use client";

import { useEffect, useRef, useState } from "react";
import {
  webhooksApi,
  type CreatedWebhookEndpointResponseDto,
} from "@/lib/api";
import { WebhookEventTypePicker } from "./WebhookEventTypePicker";

type Stage = "form" | "reveal";

function isValidHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname.length > 0;
  } catch {
    return false;
  }
}

function isValidApiVersion(value: string): boolean {
  // YYYY-MM-DD, lazy check (backend re-validates).
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function CreateWebhookEndpointDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (endpoint: CreatedWebhookEndpointResponseDto) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("form");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiVersion, setApiVersion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [created, setCreated] = useState<CreatedWebhookEndpointResponseDto | null>(
    null,
  );
  const [copyStamp, setCopyStamp] = useState<string | null>(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  // Open / close
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      setTimeout(() => urlRef.current?.focus(), 50);
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setStage("form");
    setUrl("");
    setDescription("");
    setEventTypes([]);
    setShowAdvanced(false);
    setApiVersion("");
    setSubmitting(false);
    setError(null);
    setCreated(null);
    setCopyStamp(null);
    setSavedConfirmed(false);
  }, [open]);

  // Reveal stage's ONLY exit is the Done button.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      if (stage === "reveal") e.preventDefault();
    };
    const onCloseEvt = () => {
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
    if (!isValidHttpsUrl(url)) {
      setError("URL must be HTTPS and resolve to a public host.");
      urlRef.current?.focus();
      return;
    }
    if (eventTypes.length === 0) {
      setError("Subscribe to at least one event.");
      return;
    }
    if (apiVersion && !isValidApiVersion(apiVersion)) {
      setError("API version must be YYYY-MM-DD.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await webhooksApi.create({
        url: url.trim(),
        eventTypes,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(apiVersion ? { apiVersion } : {}),
      });
      setCreated(result);
      setStage("reveal");
    } catch (e) {
      const err = e as { response?: { data?: { message?: string; code?: string } } };
      const msg =
        err.response?.data?.message ||
        (e instanceof Error ? e.message : "Failed to create endpoint.");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.plaintextSecret);
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setCopyStamp(`${hh}:${mm}:${ss}`);
      setTimeout(() => setCopyStamp(null), 4000);
    } catch {
      setError(
        "Clipboard unavailable. Select the secret above and copy it manually.",
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
        className="modal-box max-w-xl overflow-visible"
        style={{
          animation: "op-panel-fade-in 160ms cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        {stage === "form" ? (
          <FormStage
            urlRef={urlRef}
            url={url}
            setUrl={setUrl}
            description={description}
            setDescription={setDescription}
            eventTypes={eventTypes}
            setEventTypes={setEventTypes}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            apiVersion={apiVersion}
            setApiVersion={setApiVersion}
            submitting={submitting}
            error={error}
            onCancel={onClose}
            onGenerate={() => void handleGenerate()}
          />
        ) : (
          <RevealStage
            secret={created?.plaintextSecret ?? ""}
            url={created?.url ?? ""}
            copyStamp={copyStamp}
            savedConfirmed={savedConfirmed}
            setSavedConfirmed={setSavedConfirmed}
            error={error}
            onCopy={() => void handleCopy()}
            onDone={handleDone}
          />
        )}
      </div>
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
  urlRef,
  url,
  setUrl,
  description,
  setDescription,
  eventTypes,
  setEventTypes,
  showAdvanced,
  setShowAdvanced,
  apiVersion,
  setApiVersion,
  submitting,
  error,
  onCancel,
  onGenerate,
}: {
  urlRef: React.RefObject<HTMLInputElement | null>;
  url: string;
  setUrl: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  eventTypes: string[];
  setEventTypes: (v: string[]) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  apiVersion: string;
  setApiVersion: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onGenerate: () => void;
}) {
  return (
    <>
      <span className="op-label">create webhook endpoint</span>
      <h3 className="mt-1 text-[1.0625rem] font-semibold tracking-[-0.015em]">
        New endpoint
      </h3>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-base-content/60">
        MsgBuddy will POST signed events to this URL as messages and
        templates change state.
      </p>

      <div className="mt-5 max-h-[60vh] space-y-5 overflow-y-auto pr-1">
        <div>
          <label className="op-label mb-1.5 block" htmlFor="wh-url">
            url
          </label>
          <input
            ref={urlRef}
            id="wh-url"
            type="url"
            className="input input-bordered input-sm w-full font-mono-op"
            placeholder="https://your-app.example.com/integrations/msgbuddy"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={submitting}
          />
          <p className="mt-1 font-mono-op text-[0.6875rem] text-base-content/40">
            HTTPS only. Must resolve to a public host (private / loopback /
            link-local IPs are rejected).
          </p>
        </div>

        <div>
          <label className="op-label mb-1.5 block" htmlFor="wh-desc">
            label
          </label>
          <input
            id="wh-desc"
            type="text"
            className="input input-bordered input-sm w-full"
            placeholder="e.g. ERP — production"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            disabled={submitting}
          />
          <p className="mt-1 font-mono-op text-[0.6875rem] text-base-content/40">
            Optional. Shown in the endpoint list.
          </p>
        </div>

        <WebhookEventTypePicker
          value={eventTypes}
          onChange={setEventTypes}
          disabled={submitting}
        />

        <div>
          <button
            type="button"
            className="font-mono-op text-[0.6875rem] tracking-[0.12em] uppercase text-base-content/55 hover:text-base-content"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={submitting}
          >
            {showAdvanced ? "− hide advanced" : "+ show advanced"}
          </button>
          {showAdvanced ? (
            <div className="mt-3 rounded-box border border-base-300 bg-base-200 p-3">
              <label className="op-label mb-1.5 block" htmlFor="wh-apiversion">
                envelope api-version
              </label>
              <input
                id="wh-apiversion"
                type="text"
                className="input input-bordered input-sm w-full font-mono-op"
                placeholder="2026-05-01"
                value={apiVersion}
                onChange={(e) => setApiVersion(e.target.value)}
                disabled={submitting}
              />
              <p className="mt-1 font-mono-op text-[0.6875rem] text-base-content/40">
                Override the workspace default. Format YYYY-MM-DD. Leave
                blank to use the workspace value.
              </p>
            </div>
          ) : null}
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
          Create endpoint
        </button>
      </div>
    </>
  );
}

function RevealStage({
  secret,
  url,
  copyStamp,
  savedConfirmed,
  setSavedConfirmed,
  error,
  onCopy,
  onDone,
}: {
  secret: string;
  url: string;
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
        endpoint created
      </span>
      <h3
        className="mt-1 italic text-[1.25rem] leading-snug tracking-[-0.015em]"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Here is your signing secret.
      </h3>
      <p className="mt-2 break-all font-mono-op text-[0.78125rem] text-base-content/60">
        {url}
      </p>

      <div
        className="op-grain mt-5 flex items-center gap-3 rounded-box border border-base-300 bg-[var(--op-bg-2)] px-5 py-4"
        style={{
          animation:
            "op-panel-fade-in 200ms 60ms cubic-bezier(0.2, 0, 0, 1) backwards",
        }}
      >
        <code
          className="flex-1 select-all break-all font-mono-op text-[1.0625rem] tabular-nums tracking-tight text-base-content/95"
          aria-label="Signing secret value"
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

      <div
        className="mt-4 rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3"
        style={{
          animation:
            "op-panel-fade-in 200ms 140ms cubic-bezier(0.2, 0, 0, 1) backwards",
        }}
      >
        <span
          className="op-label mb-1 block"
          style={{ color: "var(--op-warn)" }}
        >
          one-time view
        </span>
        <p className="text-[0.8125rem] leading-relaxed">
          MsgBuddy will sign every delivery with HMAC-SHA256 over the raw
          request body and pass the result in{" "}
          <code className="font-mono-op text-base-content/80">
            X-MsgBuddy-Signature
          </code>
          . Save this secret in your verification code now — it cannot be
          retrieved later, only rotated.
        </p>
      </div>

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
          I&apos;ve saved this secret in my verification code or secret
          store.
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
