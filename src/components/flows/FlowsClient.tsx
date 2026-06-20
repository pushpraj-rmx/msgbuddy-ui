"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { flowApi, type Flow, type FlowTrigger } from "@/lib/api";
import { Plus, Pencil, Trash2 } from "lucide-react";

const TRIGGER_LABELS: Record<FlowTrigger, string> = {
  WELCOME: "First message",
  KEYWORD: "Keyword",
  MANUAL: "Manual",
};

/** A new flow starts with just a Start node; the editor builds the rest. */
function defaultGraph() {
  return {
    nodes: [{ id: "n_start", type: "start", data: {}, position: { x: 280, y: 40 } }],
    edges: [],
  };
}

export function FlowsClient() {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create form
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<FlowTrigger>("WELCOME");
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setFlows(await flowApi.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load flows");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const triggerConfig =
        trigger === "KEYWORD"
          ? {
              keywords: keywords
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean),
            }
          : undefined;
      const flow = await flowApi.create({
        name: name.trim(),
        trigger,
        triggerConfig,
        graph: defaultGraph(),
      });
      router.push(`/flows/${flow.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create flow");
      setSaving(false);
    }
  };

  const onTogglePublish = async (flow: Flow) => {
    setBusyId(flow.id);
    setError(null);
    try {
      const updated =
        flow.status === "PUBLISHED"
          ? await flowApi.unpublish(flow.id)
          : await flowApi.publish(flow.id);
      setFlows((prev) =>
        (prev ?? []).map((f) => (f.id === flow.id ? updated : f)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change publish state");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (flow: Flow) => {
    if (!confirm(`Delete flow "${flow.name}"? This can't be undone.`)) return;
    setBusyId(flow.id);
    setError(null);
    try {
      await flowApi.remove(flow.id);
      setFlows((prev) => (prev ?? []).filter((f) => f.id !== flow.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete flow");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] text-base-content/60">
          Published flows take precedence over the AI chatbot for matching
          inbound messages.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setCreating((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          New flow
        </button>
      </div>

      {creating ? (
        <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-3">
          <span className="op-section-title">New flow</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control w-full">
              <span className="op-label mb-1">Name</span>
              <input
                className="input input-bordered input-sm w-full"
                placeholder="Welcome + route to sales"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="form-control w-full">
              <span className="op-label mb-1">Trigger</span>
              <select
                className="select select-bordered select-sm w-full"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as FlowTrigger)}
              >
                <option value="WELCOME">First message from a contact</option>
                <option value="KEYWORD">Keyword match</option>
                <option value="MANUAL">Manual / API only</option>
              </select>
            </label>
          </div>
          {trigger === "KEYWORD" ? (
            <label className="form-control w-full">
              <span className="op-label mb-1">Keywords (comma-separated)</span>
              <input
                className="input input-bordered input-sm w-full"
                placeholder="price, pricing, cost"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </label>
          ) : null}
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
              disabled={saving || !name.trim()}
            >
              {saving ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "Create & edit"
              )}
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

      {flows === null ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner" />
        </div>
      ) : flows.length === 0 ? (
        <div className="rounded-box border border-dashed border-base-300 px-4 py-12 text-center">
          <p className="text-sm text-base-content/60">
            No flows yet. Create one to start building.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Trigger</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.id}>
                  <td>
                    <Link href={`/flows/${flow.id}`} className="link link-hover font-medium">
                      {flow.name}
                    </Link>
                  </td>
                  <td className="text-base-content/70">
                    {TRIGGER_LABELS[flow.trigger]}
                  </td>
                  <td>
                    <span className={flow.status === "PUBLISHED" ? "op-tag op-tag-ok" : "op-tag"}>
                      {flow.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/flows/${flow.id}`}
                        className="btn btn-ghost btn-xs"
                        aria-label="Edit flow"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => onTogglePublish(flow)}
                        disabled={busyId === flow.id}
                      >
                        {flow.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => onDelete(flow)}
                        disabled={busyId === flow.id}
                        aria-label="Delete flow"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
