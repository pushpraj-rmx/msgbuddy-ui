"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type WorkspaceSettingsPayload, workspaceApi } from "@/lib/api";
import type { WorkspaceSettings } from "@/components/settings/types";

export function ChatbotSettingsClient({
  workspaceId,
  settings,
}: {
  workspaceId: string;
  settings: WorkspaceSettings;
}) {
  const router = useRouter();

  // `mode` is the 3-state AI selector; on save it maps to chatbotEnabled
  // (disabled => false) + aiKeySource (BYO | MANAGED).
  const initialChatbotMode: "disabled" | "byo" | "managed" =
    !settings.chatbotEnabled
      ? "disabled"
      : settings.aiKeySource === "MANAGED"
        ? "managed"
        : "byo";
  const [chatbotForm, setChatbotForm] = useState({
    mode: initialChatbotMode,
    chatbotSystemPrompt: settings.chatbotSystemPrompt ?? "",
    chatbotApiKey: "",
    chatbotProvider: settings.chatbotProvider ?? "anthropic",
    chatbotModel: settings.chatbotModel ?? "claude-sonnet-4-20250514",
  });
  const [savingChatbot, setSavingChatbot] = useState(false);
  const [chatbotError, setChatbotError] = useState<string | null>(null);
  const [chatbotSaved, setChatbotSaved] = useState(false);

  const onSaveChatbot = async () => {
    setSavingChatbot(true);
    setChatbotError(null);
    setChatbotSaved(false);
    try {
      const enabled = chatbotForm.mode !== "disabled";
      // Managed mode always runs on MsgBuddy's Anthropic key — force the
      // provider/model back to Anthropic regardless of the BYO selection.
      const isManaged = chatbotForm.mode === "managed";
      const provider = isManaged ? "anthropic" : chatbotForm.chatbotProvider;
      const model =
        isManaged && chatbotForm.chatbotModel.startsWith("gemini")
          ? "claude-sonnet-4-20250514"
          : chatbotForm.chatbotModel;
      const payload: Partial<WorkspaceSettingsPayload> = {
        chatbotEnabled: enabled,
        chatbotSystemPrompt: chatbotForm.chatbotSystemPrompt.trim() || undefined,
        chatbotProvider: provider,
        chatbotModel: model,
      };
      if (enabled) {
        payload.aiKeySource = chatbotForm.mode === "managed" ? "MANAGED" : "BYO";
      }
      // Only the BYO path carries a customer key; MANAGED uses the platform key.
      if (chatbotForm.mode === "byo" && chatbotForm.chatbotApiKey.trim()) {
        payload.chatbotApiKey = chatbotForm.chatbotApiKey.trim();
      }
      await workspaceApi.updateSettings(workspaceId, payload);
      setChatbotForm((s) => ({ ...s, chatbotApiKey: "" }));
      setChatbotSaved(true);
      router.refresh();
    } catch (e) {
      setChatbotError(e instanceof Error ? e.message : "Failed to save chatbot settings");
    } finally {
      setSavingChatbot(false);
    }
  };

  return (
    <section className="space-y-3">
      <span className="op-section-title">Chatbot</span>
      <div className="rounded-box border border-base-300 bg-base-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.875rem] font-semibold">LLM Auto-Reply</span>
              <span className={chatbotForm.mode !== "disabled" ? "op-tag op-tag-ok" : "op-tag"}>
                {chatbotForm.mode === "managed"
                  ? "MsgBuddy AI"
                  : chatbotForm.mode === "byo"
                    ? "Own key"
                    : "Disabled"}
              </span>
            </div>
            <p className="text-[0.75rem] text-base-content/55">
              Automatically replies to unassigned conversations using an LLM.
              Stops when an agent claims the conversation.
            </p>
          </div>
          <div className="join">
            <button
              type="button"
              className={`btn btn-xs join-item ${chatbotForm.mode === "disabled" ? "btn-active btn-primary" : "btn-ghost"}`}
              onClick={() => setChatbotForm((s) => ({ ...s, mode: "disabled" }))}
            >
              Off
            </button>
            <button
              type="button"
              className={`btn btn-xs join-item ${chatbotForm.mode === "byo" ? "btn-active btn-primary" : "btn-ghost"}`}
              onClick={() => setChatbotForm((s) => ({ ...s, mode: "byo" }))}
            >
              Use my key
            </button>
            <button
              type="button"
              className={`btn btn-xs join-item ${chatbotForm.mode === "managed" ? "btn-active btn-primary" : "btn-ghost"}`}
              onClick={() => setChatbotForm((s) => ({ ...s, mode: "managed" }))}
            >
              Use MsgBuddy AI
            </button>
          </div>
        </div>

        {chatbotForm.mode !== "disabled" ? (
          <>
            {chatbotForm.mode === "managed" ? (
              <div className="rounded-box border-l-2 border border-primary/30 border-l-primary bg-base-100 px-4 py-3 text-[0.8125rem] text-base-content/70">
                Uses MsgBuddy&apos;s AI — no API key required. Replies are metered
                and billed to your plan, and pause automatically when your monthly
                AI quota is reached. Track consumption on the{" "}
                <a href="/usage" className="link link-primary">
                  Usage
                </a>{" "}
                page.
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {chatbotForm.mode === "byo" ? (
                <label className="form-control w-full">
                  <span className="op-label mb-1">Provider</span>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={chatbotForm.chatbotProvider}
                    onChange={(e) => {
                      const provider = e.target.value;
                      setChatbotForm((s) => ({
                        ...s,
                        chatbotProvider: provider,
                        // reset to the provider's default model
                        chatbotModel:
                          provider === "google"
                            ? "gemini-flash-latest"
                            : "claude-sonnet-4-20250514",
                      }));
                    }}
                  >
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="google">Google (Gemini)</option>
                  </select>
                </label>
              ) : null}

              <label className="form-control w-full">
                <span className="op-label mb-1">Model</span>
                <select
                  className="select select-bordered select-sm w-full"
                  value={chatbotForm.chatbotModel}
                  onChange={(e) =>
                    setChatbotForm((s) => ({ ...s, chatbotModel: e.target.value }))
                  }
                >
                  {(chatbotForm.mode === "byo" &&
                  chatbotForm.chatbotProvider === "google" ? (
                    <>
                      <option value="gemini-flash-latest">Gemini Flash (latest)</option>
                      <option value="gemini-pro-latest">Gemini Pro (latest)</option>
                    </>
                  ) : (
                    <>
                      <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                      <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                    </>
                  ))}
                </select>
              </label>
            </div>

            {chatbotForm.mode === "byo" ? (
              <label className="form-control w-full">
                <span className="op-label mb-1">
                  API Key
                  {settings.hasChatbotApiKey ? (
                    <span className="ml-2 text-success">Key saved</span>
                  ) : null}
                </span>
                <input
                  type="password"
                  className="input input-bordered input-sm w-full font-mono"
                  placeholder="sk-ant-..."
                  value={chatbotForm.chatbotApiKey}
                  onChange={(e) =>
                    setChatbotForm((s) => ({ ...s, chatbotApiKey: e.target.value }))
                  }
                />
                <span className="mt-1 text-[0.6875rem] text-base-content/40">
                  Leave blank to keep the existing key. Enter a new value to replace it.
                </span>
              </label>
            ) : null}

            <label className="form-control w-full">
              <span className="op-label mb-1">System Prompt</span>
              <textarea
                className="textarea textarea-bordered textarea-sm w-full"
                rows={4}
                placeholder="You are a helpful customer support assistant for [Company]. Be concise, friendly, and helpful..."
                value={chatbotForm.chatbotSystemPrompt}
                onChange={(e) =>
                  setChatbotForm((s) => ({ ...s, chatbotSystemPrompt: e.target.value }))
                }
              />
            </label>

            <a href="/settings/knowledge" className="link link-primary text-[0.8125rem]">
              Manage knowledge base →
            </a>
            <p className="text-[0.6875rem] text-base-content/40">
              Ground replies in your own FAQs, policies, and product info.
            </p>
          </>
        ) : null}

        {chatbotError ? (
          <div className="rounded-box border-l-2 border border-error/30 border-l-error bg-base-200 px-4 py-3">
            <span className="op-label mb-1 block text-error">error</span>
            <p className="text-[0.8125rem]">{chatbotError}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-base-300 pt-3">
          {chatbotSaved ? <span className="text-[0.75rem] text-success">Saved.</span> : null}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSaveChatbot}
            disabled={savingChatbot}
          >
            {savingChatbot ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Saving…
              </>
            ) : (
              "Save chatbot settings"
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
