"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { contactsApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import {
    isContactImportClassified,
    isContactImportProgress,
    isContactImportTerminal,
    parseWorkspaceSseEvent,
} from "@/lib/sseEvents";
import type { ImportJob, ImportMode, ImportRowSample } from "@/lib/types";

type Step = "upload" | "analyzing" | "preview" | "importing" | "result";

const MAX_IMPORT_FILE_SIZE = 200 * 1024 * 1024; // 200 MB — hard cap; matches backend
const MAX_LABEL = "200 MB";

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const MODE_OPTIONS: Array<{ value: ImportMode; label: string; hint: string }> =
    [
        {
            value: "merge",
            label: "Merge",
            hint: "Update existing contacts with non-empty values from the file; create new contacts for unmatched phones.",
        },
        {
            value: "create_only",
            label: "Create only",
            hint: "Insert new contacts only. Skip rows whose phone already exists.",
        },
        {
            value: "update_only",
            label: "Update only",
            hint: "Update existing contacts only. Skip rows whose phone has no match.",
        },
    ];

function actionTone(action: ImportRowSample["action"]): string {
    switch (action) {
        case "create":
            return "border-success/40 text-success";
        case "update":
            return "border-info/40 text-info";
        case "skip":
            return "border-base-content/30 text-base-content/55";
        case "error":
            return "border-error/40 text-error";
    }
}

function ActionPill({ action }: { action: ImportRowSample["action"] }) {
    return (
        <span
            className={`font-mono-op rounded-[3px] border px-1.5 py-[1px] text-[0.625rem] tracking-[0.04em] uppercase ${actionTone(action)}`}
        >
            {action}
        </span>
    );
}

export function ImportModal({
    workspaceId,
    onClose,
    onSuccess,
    onError,
}: {
    workspaceId: string;
    onClose: () => void;
    onSuccess: () => void;
    onError: (message: string | null) => void;
}) {
    const [step, setStep] = useState<Step>("upload");
    const [source, setSource] = useState<"file" | "google-sheet">("file");
    const [file, setFile] = useState<File | null>(null);
    const [sheetUrl, setSheetUrl] = useState("");
    const [fileSizeError, setFileSizeError] = useState<string | null>(null);
    const [defaultCountry, setDefaultCountry] = useState("IN");
    const [mode, setMode] = useState<ImportMode>("merge");

    /** Validate before storing — files exceeding the cap are rejected immediately,
     *  so we never even start the upload. */
    const handleFileSelect = useCallback((selected: File | null) => {
        if (!selected) {
            setFile(null);
            setFileSizeError(null);
            return;
        }
        if (selected.size > MAX_IMPORT_FILE_SIZE) {
            setFile(null);
            setFileSizeError(
                `File is ${formatBytes(selected.size)}. Maximum size is ${MAX_LABEL}. Split the file into smaller chunks and import each separately.`,
            );
            return;
        }
        setFile(selected);
        setFileSizeError(null);
    }, []);

    // Active job state
    const [jobId, setJobId] = useState<string | null>(null);
    const [job, setJob] = useState<ImportJob | null>(null);
    const [starting, setStarting] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // Latest jobId in a ref so the long-lived SSE handler always filters against
    // the current job without needing to re-create the EventSource on every change.
    const jobIdRef = useRef<string | null>(null);
    useEffect(() => {
        jobIdRef.current = jobId;
    }, [jobId]);

    const refetchJob = useCallback(
        async (id: string) => {
            try {
                const fresh = await contactsApi.getImportJob(id);
                setJob(fresh);
                return fresh;
            } catch (err: unknown) {
                onError(getApiError(err));
                return null;
            }
        },
        [onError],
    );

    // ── Open the SSE connection on MOUNT ──
    // Critical: the EventSource must be subscribing BEFORE we POST to start the
    // job. SSE doesn't replay missed events, and small files can finish
    // classification in milliseconds — opening the stream after `setJobId` would
    // race the worker and miss every event.
    useEffect(() => {
        const source = new EventSource(`/api/sse/workspace/${workspaceId}`);
        source.onmessage = (event) => {
            const ev = parseWorkspaceSseEvent(event.data);
            if (!ev) return;
            const data = ev.data as { jobId?: string };
            const currentJobId = jobIdRef.current;
            if (!currentJobId || data.jobId !== currentJobId) return;

            if (isContactImportClassified(ev.type)) {
                void refetchJob(currentJobId);
            } else if (isContactImportProgress(ev.type)) {
                const p = ev.data as {
                    processed: number;
                    total: number;
                    createdCount: number;
                    updatedCount: number;
                    skippedCount: number;
                    failedCount: number;
                };
                setJob((prev) =>
                    prev
                        ? {
                              ...prev,
                              processedRows: p.processed,
                              totalRows: p.total,
                              createdCount: p.createdCount,
                              updatedCount: p.updatedCount,
                              skippedCount: p.skippedCount,
                              failedCount: p.failedCount,
                          }
                        : prev,
                );
            } else if (isContactImportTerminal(ev.type)) {
                void refetchJob(currentJobId);
            }
        };
        source.onerror = () => {
            // EventSource auto-reconnects; if it permanently closes the user can
            // hit "Refresh" to re-poll.
            source.close();
        };
        return () => source.close();
    }, [workspaceId, refetchJob]);

    // Advance the wizard based on job state changes.
    useEffect(() => {
        if (!job || !jobId) return;
        if (step === "analyzing") {
            // Dry-run job → preview when totals + sample are ready (any terminal status).
            if (
                job.status === "COMPLETED" ||
                job.status === "FAILED" ||
                job.status === "CANCELLED"
            ) {
                if (job.status === "COMPLETED" && job.dryRun) {
                    setStep("preview");
                } else if (job.status === "FAILED") {
                    onError(job.errorMessage ?? "Preview failed");
                    setStep("upload");
                    setJobId(null);
                } else if (job.status === "CANCELLED") {
                    setStep("upload");
                    setJobId(null);
                }
            }
        } else if (step === "importing") {
            if (
                job.status === "COMPLETED" ||
                job.status === "FAILED" ||
                job.status === "CANCELLED"
            ) {
                setStep("result");
                if (
                    (job.failedCount ?? 0) === 0 &&
                    job.status === "COMPLETED"
                ) {
                    onSuccess();
                }
            }
        }
    }, [job, jobId, step, onError, onSuccess]);

    /** Fires one auto-refetch ~600ms after starting a job, as a safety net for
     *  ultra-fast workers (small files) where the entire job may finish before
     *  the SSE wire delivers anything. Subsequent updates flow over SSE.
     */
    const scheduleSafetyRefetch = (id: string) => {
        setTimeout(() => {
            // Only fire if this job is still the active one (user hasn't closed/back'd).
            if (jobIdRef.current === id) {
                void refetchJob(id);
            }
        }, 600);
    };

    const startJob = async (opts: { dryRun: boolean }) => {
        const baseOpts = {
            defaultCountry: defaultCountry || "IN",
            mode,
            dryRun: opts.dryRun,
        };
        if (source === "google-sheet") {
            return contactsApi.startImportJobFromGoogleSheet(
                sheetUrl.trim(),
                baseOpts,
            );
        }
        if (!file) throw new Error("No file selected");
        return contactsApi.startImportJob(file, baseOpts);
    };

    const handlePreview = async () => {
        if (source === "file" && !file) return;
        if (source === "google-sheet" && !sheetUrl.trim()) return;
        setStarting(true);
        onError(null);
        try {
            const { jobId: id } = await startJob({ dryRun: true });
            setJobId(id);
            // Seed empty job state so the analyzing screen can render before the first SSE arrives.
            setJob(null);
            setStep("analyzing");
            scheduleSafetyRefetch(id);
        } catch (err: unknown) {
            onError(getApiError(err));
        } finally {
            setStarting(false);
        }
    };

    const handleCommit = async () => {
        if (source === "file" && !file) return;
        if (source === "google-sheet" && !sheetUrl.trim()) return;
        setStarting(true);
        onError(null);
        try {
            const { jobId: id } = await startJob({ dryRun: false });
            setJobId(id);
            setJob(null);
            setStep("importing");
            scheduleSafetyRefetch(id);
        } catch (err: unknown) {
            onError(getApiError(err));
        } finally {
            setStarting(false);
        }
    };

    const handleCancel = async () => {
        if (!jobId) return;
        setCancelling(true);
        try {
            await contactsApi.cancelImportJob(jobId);
            // Final state will arrive via SSE.
        } catch (err: unknown) {
            onError(getApiError(err));
        } finally {
            setCancelling(false);
        }
    };

    const handleRefresh = async () => {
        if (!jobId) return;
        await refetchJob(jobId);
    };

    const handleClose = () => {
        if (starting || cancelling) return;
        setFile(null);
        setSheetUrl("");
        setSource("file");
        setJobId(null);
        setJob(null);
        setStep("upload");
        onClose();
    };

    const stepNumber =
        step === "upload"
            ? 1
            : step === "analyzing"
              ? 2
              : step === "preview"
                ? 3
                : step === "importing"
                  ? 4
                  : 5;
    const stepLabel =
        step === "upload"
            ? "Upload"
            : step === "analyzing"
              ? "Analyzing"
              : step === "preview"
                ? "Preview"
                : step === "importing"
                  ? "Importing"
                  : "Result";

    const previewTotals = step === "preview" ? job : null;
    const importingTotals = step === "importing" ? job : null;
    const resultTotals = step === "result" ? job : null;

    return (
        <dialog open className="modal modal-middle">
            <div className="modal-box flex max-h-[85vh] max-w-2xl flex-col rounded-box border border-base-300 !bg-base-100 p-0">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
                    <div>
                        <span className="op-label">
                            contacts · step {stepNumber} of 5
                        </span>
                        <h3 className="mt-0.5 text-[1.0625rem] font-semibold tracking-[-0.015em]">
                            Import contacts · {stepLabel}
                        </h3>
                    </div>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-circle"
                        onClick={handleClose}
                        aria-label="Close"
                        disabled={starting || cancelling}
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {step === "upload" && (
                        <UploadStep
                            source={source}
                            setSource={setSource}
                            file={file}
                            setFile={handleFileSelect}
                            sheetUrl={sheetUrl}
                            setSheetUrl={setSheetUrl}
                            fileSizeError={fileSizeError}
                            defaultCountry={defaultCountry}
                            setDefaultCountry={setDefaultCountry}
                            mode={mode}
                            setMode={setMode}
                            disabled={starting}
                        />
                    )}

                    {step === "analyzing" && <AnalyzingStep job={job} />}

                    {step === "preview" && previewTotals && (
                        <PreviewStep job={previewTotals} />
                    )}

                    {step === "importing" && (
                        <ImportingStep job={importingTotals} />
                    )}

                    {step === "result" && resultTotals && (
                        <ResultStep job={resultTotals} />
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 border-t border-base-300 px-5 py-3">
                    {step === "upload" && (
                        <>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={handleClose}
                                disabled={starting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={handlePreview}
                                disabled={
                                    starting ||
                                    (source === "file" &&
                                        (!file || !!fileSizeError)) ||
                                    (source === "google-sheet" &&
                                        !sheetUrl.trim())
                                }
                            >
                                {starting ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs" />
                                        Starting…
                                    </>
                                ) : (
                                    "Preview →"
                                )}
                            </button>
                        </>
                    )}

                    {(step === "analyzing" || step === "importing") && (
                        <>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={handleRefresh}
                                title="Manually fetch current job state (SSE pushes most updates automatically)"
                            >
                                Refresh
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline btn-error"
                                onClick={handleCancel}
                                disabled={cancelling}
                            >
                                {cancelling ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs" />
                                        Cancelling…
                                    </>
                                ) : (
                                    "Cancel"
                                )}
                            </button>
                        </>
                    )}

                    {step === "preview" && previewTotals && (
                        <>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                    setStep("upload");
                                    setJobId(null);
                                    setJob(null);
                                }}
                                disabled={starting}
                            >
                                ← Back
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={handleCommit}
                                disabled={
                                    starting ||
                                    (previewTotals.totalRows ?? 0) -
                                        (previewTotals.skippedCount ?? 0) -
                                        (previewTotals.failedCount ?? 0) <=
                                        0
                                }
                            >
                                {starting ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs" />
                                        Starting…
                                    </>
                                ) : (
                                    `Confirm import`
                                )}
                            </button>
                        </>
                    )}

                    {step === "result" && (
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleClose}
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close"
                />
            </form>
        </dialog>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Step components
// ─────────────────────────────────────────────────────────────────────────

function UploadStep({
    source,
    setSource,
    file,
    setFile,
    sheetUrl,
    setSheetUrl,
    fileSizeError,
    defaultCountry,
    setDefaultCountry,
    mode,
    setMode,
    disabled,
}: {
    source: "file" | "google-sheet";
    setSource: (s: "file" | "google-sheet") => void;
    file: File | null;
    setFile: (f: File | null) => void;
    sheetUrl: string;
    setSheetUrl: (s: string) => void;
    fileSizeError: string | null;
    defaultCountry: string;
    setDefaultCountry: (s: string) => void;
    mode: ImportMode;
    setMode: (m: ImportMode) => void;
    disabled: boolean;
}) {
    return (
        <div className="space-y-4">
            <div role="tablist" className="tabs tabs-bordered">
                <button
                    role="tab"
                    type="button"
                    className={`tab ${source === "file" ? "tab-active" : ""}`}
                    onClick={() => setSource("file")}
                    disabled={disabled}
                >
                    Upload file
                </button>
                <button
                    role="tab"
                    type="button"
                    className={`tab ${source === "google-sheet" ? "tab-active" : ""}`}
                    onClick={() => setSource("google-sheet")}
                    disabled={disabled}
                >
                    From Google Sheet
                </button>
            </div>

            {source === "file" ? (
                <div className="space-y-1.5">
                    <span className="op-label block">File</span>
                    <input
                        type="file"
                        accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        className="file-input file-input-bordered file-input-sm w-full text-[0.8125rem]"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        disabled={disabled}
                    />
                    {fileSizeError ? (
                        <div
                            role="alert"
                            className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2"
                        >
                            <span className="op-label mb-1 block text-error">
                                file too large
                            </span>
                            <p className="text-[0.8125rem] text-base-content">
                                {fileSizeError}
                            </p>
                        </div>
                    ) : file ? (
                        <p className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/55">
                            {file.name} · {formatBytes(file.size)}
                        </p>
                    ) : null}
                    <p className="text-[0.6875rem] text-base-content/50">
                        Required column:{" "}
                        <span className="font-mono-op rounded-[3px] border border-base-300 bg-base-200 px-1 py-[1px] text-[0.625rem] tracking-[0.04em] text-base-content">
                            phone
                        </span>
                        . Optional: name, designation, email, phoneLabel,
                        emailLabel, tags, plus any custom field columns. Maximum
                        size: <strong>{MAX_LABEL}</strong> (~200K rows,
                        processed in the background).
                    </p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    <span className="op-label block">Google Sheet URL</span>
                    <input
                        type="url"
                        className="input input-bordered input-sm w-full font-mono-op text-[0.75rem]"
                        placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        disabled={disabled}
                    />
                    <div className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2">
                        <span className="op-label mb-1 block text-warning">
                            sharing required
                        </span>
                        <p className="text-[0.78125rem] text-base-content">
                            In Google Sheets, click{" "}
                            <strong>Share → General access</strong> and set it
                            to <strong>“Anyone with the link”</strong> (Viewer
                            is enough). Private sheets cannot be imported this
                            way.
                        </p>
                    </div>
                    <p className="text-[0.6875rem] text-base-content/50">
                        We read the active tab (or the{" "}
                        <code className="font-mono-op">gid</code> from the URL)
                        as CSV. Same column requirements as file upload — first
                        row is the header.
                    </p>
                </div>
            )}

            <div className="space-y-1.5">
                <span className="op-label block">Default country</span>
                <input
                    type="text"
                    placeholder="IN"
                    className="input input-bordered input-sm font-mono-op w-24 tracking-wider"
                    value={defaultCountry}
                    onChange={(e) =>
                        setDefaultCountry(
                            e.target.value.trim().toUpperCase() || "IN",
                        )
                    }
                    maxLength={2}
                    disabled={disabled}
                />
                <p className="text-[0.6875rem] text-base-content/50">
                    ISO 3166-1 alpha-2. Used for phone numbers without a country
                    code.
                </p>
            </div>

            <div className="space-y-1.5">
                <span className="op-label block">Mode</span>
                <div className="space-y-1.5">
                    {MODE_OPTIONS.map((opt) => {
                        const active = mode === opt.value;
                        return (
                            <label
                                key={opt.value}
                                className={`flex cursor-pointer items-start gap-2.5 rounded-box border px-3 py-2.5 transition-colors ${
                                    active
                                        ? "border-primary bg-primary/5"
                                        : "border-base-300 bg-base-200 hover:border-base-content/30"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="import-mode"
                                    className="radio radio-primary radio-sm mt-0.5"
                                    checked={active}
                                    onChange={() => setMode(opt.value)}
                                    disabled={disabled}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[0.8125rem] font-medium text-base-content">
                                        {opt.label}
                                    </span>
                                    <span className="mt-0.5 block text-[0.71875rem] text-base-content/55">
                                        {opt.hint}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function AnalyzingStep({ job }: { job: ImportJob | null }) {
    return (
        <div className="space-y-4">
            <div className="rounded-box border border-base-300 bg-base-200 px-4 py-6 text-center">
                <span className="loading loading-spinner loading-md" />
                <p className="mt-3 text-[0.875rem] font-semibold tracking-tight">
                    Analyzing your file…
                </p>
                <p className="mt-1 text-[0.78125rem] text-base-content/55">
                    Parsing rows, normalizing phones, and looking up existing
                    contacts.
                </p>
                {job?.totalRows ? (
                    <p className="font-mono-op mt-2 text-[0.6875rem] tabular-nums text-base-content/55">
                        {job.totalRows.toLocaleString()} rows queued
                    </p>
                ) : null}
            </div>
        </div>
    );
}

function PreviewStep({ job }: { job: ImportJob }) {
    // Backend writes the projected (willCreate/update/skip/error) counts onto
    // createdCount/updatedCount/skippedCount/failedCount during the classify
    // pass. For a dry-run job these stay as the preview; for live imports the
    // apply pass overwrites them with live progress. DO NOT use job.sample.X.length
    // — sample arrays are capped server-side at SAMPLE_LIMIT (20).
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Stat label="Total" value={job.totalRows ?? 0} />
                <Stat
                    label="Create"
                    value={job.createdCount ?? 0}
                    tone="success"
                />
                <Stat label="Update" value={job.updatedCount ?? 0} tone="info" />
                <Stat label="Skip" value={job.skippedCount ?? 0} tone="muted" />
                <Stat label="Error" value={job.failedCount ?? 0} tone="error" />
            </div>

            {(job.mergedDuplicates ?? 0) > 0 && (
                <div className="rounded-box border border-info/30 border-l-2 border-l-info bg-base-200 px-3 py-2.5">
                    <span className="op-label mb-1 block text-info">
                        duplicates merged
                    </span>
                    <p className="text-[0.8125rem] text-base-content">
                        <span className="font-mono-op tabular-nums font-semibold">
                            {(job.mergedDuplicates ?? 0).toLocaleString()}
                        </span>{" "}
                        rows in your file shared a phone with another row and
                        were merged into a single contact (later non-empty
                        fields win, tags union).
                    </p>
                </div>
            )}

            {(job.newTags.length > 0 || job.newCustomFields.length > 0) && (
                <div className="space-y-3 rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2.5">
                    <span className="op-label block text-warning">
                        will be auto-created
                    </span>
                    {job.newTags.length > 0 && (
                        <div>
                            <span className="op-label mb-1 block">
                                tags · {job.newTags.length}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {job.newTags.map((tag) => (
                                    <span key={tag} className="op-tag">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {job.newCustomFields.length > 0 && (
                        <div>
                            <span className="op-label mb-1 block">
                                custom field columns ·{" "}
                                {job.newCustomFields.length}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {job.newCustomFields.map((cf) => (
                                    <span
                                        key={cf.name}
                                        className="font-mono-op rounded-[3px] border border-base-300 bg-base-100 px-1.5 py-[1px] text-[0.6875rem] tracking-[0.02em] text-base-content/85"
                                    >
                                        {cf.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {job.sample ? (
                <SampleTable
                    rows={[
                        ...job.sample.create,
                        ...job.sample.update,
                        ...job.sample.skip,
                        ...job.sample.error,
                    ]}
                />
            ) : null}
        </div>
    );
}

function ImportingStep({ job }: { job: ImportJob | null }) {
    const total = job?.totalRows ?? 0;
    const processed = job?.processedRows ?? 0;
    const pct =
        total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

    return (
        <div className="space-y-4">
            <div className="rounded-box border border-base-300 bg-base-200 px-4 py-5">
                <div className="flex items-baseline justify-between">
                    <span className="op-label">progress</span>
                    <span className="font-mono-op text-[0.78125rem] tabular-nums text-base-content/70">
                        {processed.toLocaleString()} / {total.toLocaleString()}{" "}
                        ({pct}%)
                    </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-base-300">
                    <div
                        className="h-full bg-primary transition-[width] duration-300"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                    label="Created"
                    value={job?.createdCount ?? 0}
                    tone="success"
                />
                <Stat
                    label="Updated"
                    value={job?.updatedCount ?? 0}
                    tone="info"
                />
                <Stat
                    label="Skipped"
                    value={job?.skippedCount ?? 0}
                    tone="muted"
                />
                <Stat
                    label="Failed"
                    value={job?.failedCount ?? 0}
                    tone={(job?.failedCount ?? 0) > 0 ? "error" : "muted"}
                />
            </div>

            <p className="text-[0.71875rem] text-base-content/55">
                You can leave this window open or close it — the import keeps
                running in the background. Use the contacts list once it
                finishes.
            </p>
        </div>
    );
}

function ResultStep({ job }: { job: ImportJob }) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Created" value={job.createdCount} tone="success" />
                <Stat label="Updated" value={job.updatedCount} tone="info" />
                <Stat label="Skipped" value={job.skippedCount} tone="muted" />
                <Stat
                    label="Failed"
                    value={job.failedCount}
                    tone={job.failedCount > 0 ? "error" : "muted"}
                />
            </div>

            {job.status === "CANCELLED" ? (
                <div className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2.5">
                    <span className="op-label mb-1 block text-warning">
                        cancelled
                    </span>
                    <p className="text-[0.8125rem] text-base-content">
                        Import was cancelled. Rows already inserted are kept.
                    </p>
                </div>
            ) : null}

            {job.status === "FAILED" && job.errorMessage ? (
                <div className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2.5">
                    <span className="op-label mb-1 block text-error">
                        failed
                    </span>
                    <p className="text-[0.8125rem] text-base-content">
                        {job.errorMessage}
                    </p>
                </div>
            ) : null}

            {job.errors.length > 0 && (
                <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
                    <div className="border-b border-base-300 px-3 py-2">
                        <span className="op-label">
                            errors · {job.errors.length}
                        </span>
                    </div>
                    <table className="w-full text-[0.75rem]">
                        <thead>
                            <tr className="border-b border-base-300 bg-base-100">
                                <th className="op-label px-3 py-2 text-left font-medium">
                                    Row
                                </th>
                                <th className="op-label px-3 py-2 text-left font-medium">
                                    Message
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {job.errors.slice(0, 50).map((e, i) => (
                                <tr
                                    key={i}
                                    className="border-b border-base-300/50 last:border-b-0"
                                >
                                    <td className="font-mono-op px-3 py-1.5 tabular-nums text-base-content/65">
                                        {e.row}
                                    </td>
                                    <td className="px-3 py-1.5 text-error">
                                        {e.message}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {job.errors.length > 50 && (
                        <p className="border-t border-base-300 px-3 py-1.5 text-[0.6875rem] text-base-content/55">
                            … and {job.errors.length - 50} more errors
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

function Stat({
    label,
    value,
    tone = "default",
}: {
    label: string;
    value: number;
    tone?: "default" | "success" | "info" | "muted" | "error";
}) {
    const valueColor =
        tone === "success"
            ? "text-success"
            : tone === "info"
              ? "text-info"
              : tone === "error"
                ? "text-error"
                : tone === "muted"
                  ? "text-base-content/55"
                  : "text-base-content";
    return (
        <div className="rounded-box border border-base-300 bg-base-200 px-3 py-2 text-center">
            <div
                className={`font-mono-op text-[1.25rem] font-semibold leading-none tabular-nums ${valueColor}`}
            >
                {value.toLocaleString()}
            </div>
            <div className="op-label mt-1.5">{label}</div>
        </div>
    );
}

function SampleTable({ rows }: { rows: ImportRowSample[] }) {
    if (rows.length === 0) {
        return (
            <div className="rounded-box border border-base-300 bg-base-200 px-3 py-4 text-center text-[0.8125rem] text-base-content/55">
                No rows to preview.
            </div>
        );
    }
    return (
        <div className="rounded-box border border-base-300 bg-base-200">
            <div className="flex items-baseline justify-between border-b border-base-300 px-3 py-2">
                <span className="text-[0.8125rem] font-semibold tracking-[-0.01em]">
                    Samples
                </span>
                <span className="op-label">Preview</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-[0.75rem]">
                    <thead>
                        <tr className="border-b border-base-300 bg-base-100">
                            <th className="op-label px-3 py-2 text-left font-medium">
                                Row
                            </th>
                            <th className="op-label px-3 py-2 text-left font-medium">
                                Action
                            </th>
                            <th className="op-label px-3 py-2 text-left font-medium">
                                Phone
                            </th>
                            <th className="op-label px-3 py-2 text-left font-medium">
                                Name
                            </th>
                            <th className="op-label px-3 py-2 text-left font-medium">
                                Notes
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr
                                key={`${r.action}-${r.row}-${i}`}
                                className="border-b border-base-300/50 last:border-b-0"
                            >
                                <td className="font-mono-op px-3 py-2 tabular-nums text-base-content/65">
                                    {r.row}
                                </td>
                                <td className="px-3 py-2">
                                    <ActionPill action={r.action} />
                                </td>
                                <td className="font-mono-op px-3 py-2 tabular-nums text-base-content/85">
                                    {r.phone}
                                </td>
                                <td className="px-3 py-2 text-base-content/70">
                                    {r.name ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-[0.71875rem]">
                                    {r.action === "update" && r.diff ? (
                                        <DiffSummary diff={r.diff} />
                                    ) : r.reason ? (
                                        <span className="text-base-content/55">
                                            {r.reason}
                                        </span>
                                    ) : (
                                        <span className="text-base-content/30">
                                            —
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function DiffSummary({ diff }: { diff: NonNullable<ImportRowSample["diff"]> }) {
    const entries = Object.entries(diff);
    if (entries.length === 0) {
        return <span className="text-base-content/30">no changes</span>;
    }
    return (
        <div className="space-y-0.5">
            {entries.map(([field, d]) => (
                <div key={field} className="leading-tight">
                    <span className="op-label mr-1">{field}</span>
                    <span className="text-base-content/40 line-through">
                        {d.from ?? "—"}
                    </span>
                    <span className="text-base-content/40"> → </span>
                    <span className="text-base-content">{d.to ?? "—"}</span>
                </div>
            ))}
        </div>
    );
}
