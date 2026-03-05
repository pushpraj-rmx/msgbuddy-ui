"use client";

import { useState } from "react";
import { contactsApi } from "@/lib/api";
import type { ImportResult } from "@/lib/types";

export function ImportModal({
  onClose,
  onSuccess,
  onError,
}: {
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [defaultCountry, setDefaultCountry] = useState("IN");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    onError(null);
    setResult(null);
    try {
      const data = await contactsApi.importCsv(file, {
        defaultCountry: defaultCountry || "IN",
      });
      setResult(data);
      if (data.failed === 0) {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to import contacts.";
      onError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-lg">
        <h3 className="text-lg font-semibold">Import contacts</h3>
        <p className="mt-1 text-sm text-base-content/70">
          Upload a CSV or Excel file. Default country is used for phone numbers
          without a country code. Required column: <kbd className="kbd kbd-sm">phone</kbd>. Optional: name, email, tags, and custom field columns.
        </p>
        <div className="mt-4 space-y-4">
          <label className="label">
            <span className="label-text">File</span>
          </label>
          <input
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="file-input file-input-bordered w-full"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
          <div>
            <label className="label">
              <span className="label-text">Default country code (ISO 3166-1 alpha-2)</span>
            </label>
            <input
              type="text"
              placeholder="IN"
              className="input input-bordered w-full max-w-24"
              value={defaultCountry}
              onChange={(e) =>
                setDefaultCountry(e.target.value.trim().toUpperCase() || "IN")
              }
              maxLength={2}
              disabled={uploading}
            />
          </div>

          {result && (
            <div className="space-y-2 rounded-box border border-base-300 bg-base-200 p-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-success">
                  Imported: <strong>{result.imported}</strong>
                </span>
                <span className="text-error">
                  Failed: <strong>{result.failed}</strong>
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.slice(0, 20).map((e, i) => (
                        <tr key={i}>
                          <td>{e.row}</td>
                          <td className="text-error text-xs">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.errors.length > 20 && (
                    <p className="mt-1 text-xs text-base-content/60">
                      … and {result.errors.length - 20} more errors
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleClose}
            disabled={uploading}
          >
            {result ? "Done" : "Cancel"}
          </button>
          {!result && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!file || uploading}
            >
              {uploading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Importing…
                </>
              ) : (
                "Import"
              )}
            </button>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={handleClose} aria-label="Close" />
      </form>
    </dialog>
  );
}
