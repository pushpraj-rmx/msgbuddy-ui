"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Search as SearchIcon, Star, X as XIcon } from "lucide-react";
import { templatesApi } from "@/lib/api";
import type { Template } from "@/lib/types";
import { getWaCategory } from "@/lib/templateCategory";
import { extractApiErrorMessage } from "@/lib/messageApiErrors";

/**
 * The WhatsApp template picker modal — the browsing surface for the inbox
 * composer. It owns ONLY the browse state (tabs, search, per-tab lists, the
 * starred-id set); the selected template's version/variables/media/preview and
 * the actual send are still owned by TemplateComposer and passed in as
 * `children` (the right-hand detail pane) + the `ready`/`onSend` props. This
 * keeps the send path untouched — the modal never builds a payload itself.
 */

type PickerTab = "recent" | "utility" | "marketing" | "starred";

const TABS: Array<{ key: PickerTab; label: string }> = [
  { key: "recent", label: "Recent" },
  { key: "utility", label: "Utility" },
  { key: "marketing", label: "Marketing" },
  { key: "starred", label: "Starred" },
];

/** Empty-state copy per tab (approved = has a sendable WhatsApp version). */
const EMPTY_LABEL: Record<PickerTab, string> = {
  recent: "No recently used templates yet.",
  utility: "No approved Utility templates yet.",
  marketing: "No approved Marketing templates yet.",
  starred: "No starred templates yet. Tap a star to save one.",
};

/** Category badge tones — mirror WhatsAppTemplatePreview's CATEGORY_STYLES. */
const CATEGORY_BADGE: Record<string, string> = {
  MARKETING: "op-tag op-tag-info",
  UTILITY: "op-tag op-tag-ok",
  AUTHENTICATION: "op-tag op-tag-warn",
};

function tabMap<T>(value: T): Record<PickerTab, T> {
  return { recent: value, utility: value, marketing: value, starred: value };
}

export interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Reset cached lists / star set when the workspace changes. */
  workspaceId: string;
  selectedTemplateId: string;
  /** Selecting a row hands the whole Template back so the composer can resolve its version. */
  onSelectTemplate: (template: Template) => void;
  /** Readiness predicate from TemplateComposer — gates the Send button. */
  ready: boolean;
  /** Parent send-in-flight flag (prevents a double send from the modal). */
  sending?: boolean;
  /** Parent's send handler (InboxClient.handleSend) — the modal drives the SAME send. */
  onSend?: () => void;
  /** Right-pane content: live preview + variable inputs + media binding, built by TemplateComposer. */
  children: ReactNode;
}

export function TemplatePickerModal({
  open,
  onClose,
  workspaceId,
  selectedTemplateId,
  onSelectTemplate,
  ready,
  sending,
  onSend,
  children,
}: TemplatePickerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<PickerTab>("recent");
  const [search, setSearch] = useState("");
  const [lists, setLists] = useState<Record<PickerTab, Template[] | null>>(() =>
    tabMap<Template[] | null>(null)
  );
  const [loading, setLoading] = useState<Record<PickerTab, boolean>>(() =>
    tabMap(false)
  );
  const [errors, setErrors] = useState<Record<PickerTab, string | null>>(() =>
    tabMap<string | null>(null)
  );
  /** Starred ids across all tabs (seeded from starred() on open, optimistic on toggle). */
  const [starredIds, setStarredIds] = useState<Set<string>>(() => new Set());
  const [starBusy, setStarBusy] = useState<Set<string>>(() => new Set());

  // Sync the native <dialog> with the `open` prop.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Reflect native close (Esc / backdrop click) back into React state.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener("close", handler);
    return () => el.removeEventListener("close", handler);
  }, [onClose]);

  // Invalidate cached lists + star set when the workspace changes.
  useEffect(() => {
    setLists(tabMap<Template[] | null>(null));
    setStarredIds(new Set());
  }, [workspaceId]);

  const fetchTab = useCallback(async (t: PickerTab) => {
    setLoading((p) => ({ ...p, [t]: true }));
    setErrors((p) => ({ ...p, [t]: null }));
    try {
      let items: Template[] = [];
      if (t === "recent") {
        items = (await templatesApi.recent()).items ?? [];
      } else if (t === "starred") {
        items = (await templatesApi.starred()).items ?? [];
        setStarredIds(new Set(items.map((i) => i.id)));
      } else {
        const category = t === "utility" ? "UTILITY" : "MARKETING";
        items =
          (
            await templatesApi.list({
              category,
              hasWhatsAppSendableVersion: true,
              limit: 50,
              sortBy: "updatedAt",
              sortOrder: "desc",
            })
          ).items ?? [];
      }
      setLists((p) => ({ ...p, [t]: items }));
    } catch (err: unknown) {
      setErrors((p) => ({
        ...p,
        [t]: extractApiErrorMessage(err) || "Failed to load templates.",
      }));
      setLists((p) => ({ ...p, [t]: [] }));
    } finally {
      setLoading((p) => ({ ...p, [t]: false }));
    }
  }, []);

  // Load the active tab on first open / switch (cached thereafter).
  useEffect(() => {
    if (!open) return;
    if (lists[tab] === null && !loading[tab]) void fetchTab(tab);
  }, [open, tab, lists, loading, fetchTab]);

  // Seed the star set on open so ★ state is correct on every tab, not just Starred.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void templatesApi
      .starred()
      .then((res) => {
        if (!cancelled) {
          setStarredIds(new Set((res.items ?? []).map((i) => i.id)));
        }
      })
      .catch(() => {
        // non-fatal — stars just render empty until a manual toggle
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggleStar = useCallback(
    async (template: Template) => {
      const id = template.id;
      if (starBusy.has(id)) return;
      const wasStarred = starredIds.has(id);
      setStarBusy((prev) => new Set(prev).add(id));
      // Optimistic flip.
      setStarredIds((prev) => {
        const next = new Set(prev);
        if (wasStarred) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        if (wasStarred) await templatesApi.unstar(id);
        else await templatesApi.star(id);
      } catch {
        // Revert on failure.
        setStarredIds((prev) => {
          const next = new Set(prev);
          if (wasStarred) next.add(id);
          else next.delete(id);
          return next;
        });
      } finally {
        setStarBusy((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [starBusy, starredIds]
  );

  const rows = useMemo(() => {
    // Keep AUTHENTICATION templates out of the manual-send picker (Meta usage
    // alignment). Matters for the Starred tab, which isn't category-filtered
    // server-side; a no-op for Recent/Utility/Marketing.
    const list = (lists[tab] ?? []).filter(
      (t) => getWaCategory(t.channelTemplates) !== "AUTHENTICATION"
    );
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        (t.name ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
    );
  }, [lists, tab, search]);

  const isLoading = loading[tab];
  const tabError = errors[tab];

  return (
    <dialog ref={dialogRef} className="modal modal-middle">
      <div className="modal-box flex h-[85vh] max-h-[85vh] w-11/12 max-w-4xl flex-col overflow-hidden p-0">
        {/* Header: title + search + tabs */}
        <div className="shrink-0 space-y-2 border-b border-base-300 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="op-label text-primary">whatsapp</span>
              <h3 className="mt-0.5 text-[1.0625rem] font-semibold tracking-[-0.015em]">
                Choose a template
              </h3>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Close"
              onClick={onClose}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <label className="input input-bordered flex items-center gap-2">
            <SearchIcon className="h-4 w-4 shrink-0 text-base-content/50" />
            <input
              type="text"
              className="grow"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div role="tablist" className="tabs tabs-bordered">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                className={`tab ${tab === t.key ? "tab-active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body: list (left / top) + detail (right / bottom) */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* List pane */}
          <div className="max-h-52 shrink-0 overflow-y-auto border-b border-base-300 md:max-h-none md:w-2/5 md:border-b-0 md:border-r">
            {isLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-base-content/60">
                <span className="loading loading-spinner loading-sm" />
                Loading…
              </div>
            ) : tabError ? (
              <div
                role="alert"
                className="m-3 rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm"
              >
                {tabError}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-4 text-sm text-base-content/55">
                {search.trim()
                  ? "No templates match your search."
                  : EMPTY_LABEL[tab]}
              </div>
            ) : (
              <ul className="divide-y divide-base-200">
                {rows.map((t) => {
                  const category = getWaCategory(t.channelTemplates);
                  const active = t.id === selectedTemplateId;
                  const starred = starredIds.has(t.id);
                  return (
                    <li key={t.id}>
                      <div
                        className={`flex items-start gap-2 px-3 py-2 ${
                          active ? "bg-primary/10" : "hover:bg-base-200"
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => onSelectTemplate(t)}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-base-content">
                              {t.name}
                            </span>
                            {category ? (
                              <span
                                className={`${
                                  CATEGORY_BADGE[category] ?? "op-tag"
                                } shrink-0`}
                              >
                                {category}
                              </span>
                            ) : null}
                          </div>
                          {t.description ? (
                            <p className="mt-0.5 line-clamp-1 text-xs text-base-content/55">
                              {t.description}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs text-base-content/35">
                              No description
                            </p>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square shrink-0"
                          aria-label={
                            starred ? "Unstar template" : "Star template"
                          }
                          aria-pressed={starred}
                          disabled={starBusy.has(t.id)}
                          onClick={() => void toggleStar(t)}
                        >
                          <Star
                            className={
                              starred
                                ? "h-4 w-4 fill-current text-warning"
                                : "h-4 w-4 text-base-content/40"
                            }
                          />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Detail pane — preview + variables + media, owned by TemplateComposer */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 md:w-3/5">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-base-300 p-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!ready || sending === true}
              onClick={() => {
                onSend?.();
                onClose();
              }}
            >
              {sending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : null}
              Send
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" aria-label="Close">
          close
        </button>
      </form>
    </dialog>
  );
}
