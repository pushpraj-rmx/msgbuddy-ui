"use client";

import { useState } from "react";
import { knowledgeApi, type KnowledgeDoc } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

function StatusBadge({ status }: { status: KnowledgeDoc["status"] }) {
  if (status === "EMBEDDED") return <span className="op-tag op-tag-ok">Embedded</span>;
  if (status === "FAILED") return <span className="op-tag text-error">Failed</span>;
  return <span className="op-tag">Not embedded</span>;
}

export function KnowledgeClient({
  initial,
  canManage,
}: {
  initial: KnowledgeDoc[];
  canManage: boolean;
}) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>(initial);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const hasUnembedded = docs.some((d) => d.status !== "EMBEDDED");

  const onCreate = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const doc = await knowledgeApi.create({
        title: title.trim(),
        content: content.trim(),
      });
      setDocs((prev) => [doc, ...prev]);
      setTitle("");
      setContent("");
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add document");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (doc: KnowledgeDoc) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    setBusyId(doc.id);
    setError(null);
    try {
      await knowledgeApi.remove(doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setCreating((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            Add document
          </button>
        </div>
      ) : null}

      {hasUnembedded ? (
        <div className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3 text-[0.8125rem] text-base-content/70">
          Documents marked <span className="font-medium">Not embedded</span> are
          stored but not yet searchable. Embedding requires the{" "}
          <code className="text-xs">VOYAGE_API_KEY</code> and the pgvector
          database extension to be configured.
        </div>
      ) : null}

      {creating ? (
        <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-3">
          <label className="form-control w-full">
            <span className="op-label mb-1">Title</span>
            <input
              className="input input-bordered input-sm w-full"
              placeholder="Refund policy"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="form-control w-full">
            <span className="op-label mb-1">Content</span>
            <textarea
              className="textarea textarea-bordered textarea-sm w-full"
              rows={8}
              placeholder="Paste the FAQ, policy, or product info the bot should know…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setCreating(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onCreate}
              disabled={saving || !title.trim() || !content.trim()}
            >
              {saving ? <span className="loading loading-spinner loading-xs" /> : "Add & embed"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-box border-l-2 border border-error/30 border-l-error bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem]">{error}</p>
        </div>
      ) : null}

      {docs.length === 0 ? (
        <div className="rounded-box border border-dashed border-base-300 px-4 py-12 text-center">
          <p className="text-sm text-base-content/60">
            No documents yet. Add FAQs, policies, or product info for the bot to
            draw on.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Title</th>
                <th>Chunks</th>
                <th>Status</th>
                {canManage ? <th className="text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td className="font-medium">{doc.title}</td>
                  <td className="text-base-content/70">{doc._count?.chunks ?? 0}</td>
                  <td>
                    <StatusBadge status={doc.status} />
                    {doc.status === "FAILED" && doc.error ? (
                      <span className="ml-2 text-xs text-error/80">{doc.error}</span>
                    ) : null}
                  </td>
                  {canManage ? (
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => onDelete(doc)}
                        disabled={busyId === doc.id}
                        aria-label="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
