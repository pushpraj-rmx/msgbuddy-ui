"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft } from "lucide-react";
import { flowApi, type Flow, type FlowGraph } from "@/lib/api";

// ── Node catalogue ──────────────────────────────────────────────────────────
type NodeType =
  | "start"
  | "send_text"
  | "send_buttons"
  | "send_template"
  | "wait_reply"
  | "branch"
  | "add_tag"
  | "assign_agent"
  | "handoff_ai"
  | "end";

interface NodeDef {
  label: string;
  hasTarget: boolean;
  hasSource: boolean; // single bottom source (branch overrides with dynamic)
  defaultData: Record<string, unknown>;
}

const NODE_DEFS: Record<NodeType, NodeDef> = {
  start: { label: "Start", hasTarget: false, hasSource: true, defaultData: {} },
  send_text: { label: "Send text", hasTarget: true, hasSource: true, defaultData: { text: "" } },
  send_buttons: {
    label: "Send buttons",
    hasTarget: true,
    hasSource: true,
    defaultData: { text: "", buttons: [{ id: "opt1", label: "Option 1" }] },
  },
  send_template: { label: "Send template", hasTarget: true, hasSource: true, defaultData: { channelTemplateVersionId: "" } },
  wait_reply: { label: "Wait for reply", hasTarget: true, hasSource: true, defaultData: {} },
  branch: { label: "Branch", hasTarget: true, hasSource: false, defaultData: { rules: [] } },
  add_tag: { label: "Add tag", hasTarget: true, hasSource: true, defaultData: { tagId: "" } },
  assign_agent: { label: "Assign agent", hasTarget: true, hasSource: false, defaultData: {} },
  handoff_ai: { label: "Handoff to AI", hasTarget: true, hasSource: false, defaultData: {} },
  end: { label: "End", hasTarget: true, hasSource: false, defaultData: {} },
};

const PALETTE: NodeType[] = [
  "send_text",
  "send_buttons",
  "send_template",
  "wait_reply",
  "branch",
  "add_tag",
  "assign_agent",
  "handoff_ai",
  "end",
];

interface BranchRule {
  matchType: "BUTTON" | "KEYWORD";
  value: string;
  handle: string;
}

// ── Custom node renderer ────────────────────────────────────────────────────
function FlowNodeCard({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>;
  const nodeType = d.nodeType as NodeType;
  const def = NODE_DEFS[nodeType];
  const rules = (d.rules as BranchRule[]) ?? [];

  const summary = (() => {
    switch (nodeType) {
      case "send_text":
        return (d.text as string) || "(empty)";
      case "send_buttons":
        return `${(d.text as string) || "(no text)"} · ${((d.buttons as unknown[]) ?? []).length} buttons`;
      case "send_template":
        return (d.channelTemplateVersionId as string) || "(no template)";
      case "add_tag":
        return (d.tagId as string) || "(no tag)";
      case "branch":
        return `${rules.length} rules`;
      default:
        return "";
    }
  })();

  return (
    <div
      className={`min-w-40 rounded-box border bg-base-100 px-3 py-2 text-xs shadow-sm ${
        selected ? "border-primary" : "border-base-300"
      }`}
    >
      {def?.hasTarget ? <Handle type="target" position={Position.Top} /> : null}
      <div className="font-semibold text-base-content">{def?.label ?? nodeType}</div>
      {summary ? (
        <div className="mt-0.5 max-w-48 truncate text-base-content/55">{summary}</div>
      ) : null}

      {nodeType === "branch" ? (
        <>
          {rules.map((r, i) => (
            <Handle
              key={r.handle}
              type="source"
              id={r.handle}
              position={Position.Bottom}
              style={{ left: `${((i + 1) / (rules.length + 2)) * 100}%` }}
            />
          ))}
          <Handle
            type="source"
            id="default"
            position={Position.Bottom}
            style={{ left: `${((rules.length + 1) / (rules.length + 2)) * 100}%` }}
          />
        </>
      ) : def?.hasSource ? (
        <Handle type="source" position={Position.Bottom} />
      ) : null}
    </div>
  );
}

const nodeTypes = { flowNode: FlowNodeCard };

// ── Graph <-> React Flow conversion ─────────────────────────────────────────
function toRfNodes(graph: FlowGraph): Node[] {
  return graph.nodes.map((n, i) => ({
    id: n.id,
    type: "flowNode",
    position: n.position ?? { x: 120 + (i % 3) * 220, y: 120 + Math.floor(i / 3) * 140 },
    data: { ...n.data, nodeType: n.type },
  }));
}

function toRfEdges(graph: FlowGraph): Edge[] {
  return graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
  }));
}

function toGraph(nodes: Node[], edges: Edge[]): FlowGraph {
  return {
    nodes: nodes.map((n) => {
      const { nodeType, ...rest } = n.data as Record<string, unknown>;
      return { id: n.id, type: nodeType as string, data: rest, position: n.position };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
    })),
  };
}

// ── Editor ──────────────────────────────────────────────────────────────────
export function FlowEditorClient({ flowId }: { flowId: string }) {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    flowApi
      .get(flowId)
      .then((f) => {
        setFlow(f);
        setNodes(toRfNodes(f.graph));
        setEdges(toRfEdges(f.graph));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load flow"));
  }, [flowId, setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  const addNode = (type: NodeType) => {
    const id = `n_${type}_${crypto.randomUUID().slice(0, 6)}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "flowNode",
        position: { x: 200 + Math.random() * 120, y: 200 + Math.random() * 120 },
        data: { ...structuredClone(NODE_DEFS[type].defaultData), nodeType: type },
      },
    ]);
  };

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const patchSelected = (patch: Record<string, unknown>) => {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const updated = await flowApi.update(flowId, { graph: toGraph(nodes, edges) });
      setFlow(updated);
      setStatus("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await flowApi.update(flowId, { graph: toGraph(nodes, edges) });
      const updated = await flowApi.publish(flowId);
      setFlow(updated);
      setStatus("Published.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3.75rem)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-base-300 px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => router.push("/flows")}
            aria-label="Back to flows"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="truncate text-sm font-semibold">
            {flow?.name ?? "Loading…"}
          </span>
          {flow ? (
            <span className={flow.status === "PUBLISHED" ? "op-tag op-tag-ok" : "op-tag"}>
              {flow.status === "PUBLISHED" ? "Published" : "Draft"}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {status ? <span className="text-[0.75rem] text-success">{status}</span> : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={save} disabled={saving}>
            Save
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={publish} disabled={saving}>
            Save & publish
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-error/30 bg-error/10 px-4 py-2 text-[0.8125rem] text-error">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Palette */}
        <div className="w-40 shrink-0 space-y-1 overflow-y-auto border-r border-base-300 p-2">
          <p className="op-label mb-1">Add node</p>
          {PALETTE.map((t) => (
            <button
              key={t}
              type="button"
              className="btn btn-ghost btn-xs w-full justify-start"
              onClick={() => addNode(t)}
            >
              {NODE_DEFS[t].label}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        {/* Inspector */}
        {selected ? (
          <NodeInspector
            key={selected.id}
            node={selected}
            onPatch={patchSelected}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Inspector ───────────────────────────────────────────────────────────────
function NodeInspector({
  node,
  onPatch,
}: {
  node: Node;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const d = node.data as Record<string, unknown>;
  const nodeType = d.nodeType as NodeType;
  const buttons = (d.buttons as { id: string; label: string }[]) ?? [];
  const rules = (d.rules as BranchRule[]) ?? [];

  return (
    <div className="w-72 shrink-0 space-y-3 overflow-y-auto border-l border-base-300 p-3">
      <div>
        <p className="op-label">Node</p>
        <p className="text-sm font-semibold">{NODE_DEFS[nodeType]?.label ?? nodeType}</p>
      </div>

      {nodeType === "send_text" ? (
        <label className="form-control w-full">
          <span className="op-label mb-1">Message</span>
          <textarea
            className="textarea textarea-bordered textarea-sm w-full"
            rows={4}
            value={(d.text as string) ?? ""}
            onChange={(e) => onPatch({ text: e.target.value })}
          />
        </label>
      ) : null}

      {nodeType === "send_buttons" ? (
        <>
          <label className="form-control w-full">
            <span className="op-label mb-1">Message</span>
            <textarea
              className="textarea textarea-bordered textarea-sm w-full"
              rows={3}
              value={(d.text as string) ?? ""}
              onChange={(e) => onPatch({ text: e.target.value })}
            />
          </label>
          <div className="space-y-1">
            <span className="op-label">Buttons (max 3)</span>
            {buttons.map((b, i) => (
              <div key={i} className="flex gap-1">
                <input
                  className="input input-bordered input-xs w-1/3"
                  placeholder="id"
                  value={b.id}
                  onChange={(e) => {
                    const next = [...buttons];
                    next[i] = { ...b, id: e.target.value };
                    onPatch({ buttons: next });
                  }}
                />
                <input
                  className="input input-bordered input-xs flex-1"
                  placeholder="label"
                  value={b.label}
                  onChange={(e) => {
                    const next = [...buttons];
                    next[i] = { ...b, label: e.target.value };
                    onPatch({ buttons: next });
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => onPatch({ buttons: buttons.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            ))}
            {buttons.length < 3 ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs w-full"
                onClick={() =>
                  onPatch({
                    buttons: [...buttons, { id: `opt${buttons.length + 1}`, label: "" }],
                  })
                }
              >
                + button
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {nodeType === "send_template" ? (
        <label className="form-control w-full">
          <span className="op-label mb-1">Channel template version id</span>
          <input
            className="input input-bordered input-sm w-full font-mono text-xs"
            value={(d.channelTemplateVersionId as string) ?? ""}
            onChange={(e) => onPatch({ channelTemplateVersionId: e.target.value })}
          />
        </label>
      ) : null}

      {nodeType === "add_tag" ? (
        <label className="form-control w-full">
          <span className="op-label mb-1">Tag id</span>
          <input
            className="input input-bordered input-sm w-full font-mono text-xs"
            value={(d.tagId as string) ?? ""}
            onChange={(e) => onPatch({ tagId: e.target.value })}
          />
        </label>
      ) : null}

      {nodeType === "assign_agent" ? (
        <label className="form-control w-full">
          <span className="op-label mb-1">Agent user id (optional)</span>
          <input
            className="input input-bordered input-sm w-full font-mono text-xs"
            placeholder="leave blank for unassigned queue"
            value={(d.userId as string) ?? ""}
            onChange={(e) => onPatch({ userId: e.target.value || undefined })}
          />
        </label>
      ) : null}

      {nodeType === "branch" ? (
        <div className="space-y-1">
          <span className="op-label">Rules (each gets an outgoing handle)</span>
          {rules.map((r, i) => (
            <div key={r.handle} className="space-y-1 rounded-box border border-base-300 p-1.5">
              <div className="flex gap-1">
                <select
                  className="select select-bordered select-xs w-1/2"
                  value={r.matchType}
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...r, matchType: e.target.value as BranchRule["matchType"] };
                    onPatch({ rules: next });
                  }}
                >
                  <option value="BUTTON">Button</option>
                  <option value="KEYWORD">Keyword</option>
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => onPatch({ rules: rules.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
              <input
                className="input input-bordered input-xs w-full"
                placeholder={r.matchType === "BUTTON" ? "button id" : "keyword"}
                value={r.value}
                onChange={(e) => {
                  const next = [...rules];
                  next[i] = { ...r, value: e.target.value };
                  onPatch({ rules: next });
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-xs w-full"
            onClick={() =>
              onPatch({
                rules: [
                  ...rules,
                  { matchType: "BUTTON", value: "", handle: `h_${crypto.randomUUID().slice(0, 6)}` },
                ],
              })
            }
          >
            + rule
          </button>
          <p className="text-[0.6875rem] text-base-content/40">
            A &quot;default&quot; handle is always available for no-match.
          </p>
        </div>
      ) : null}
    </div>
  );
}
