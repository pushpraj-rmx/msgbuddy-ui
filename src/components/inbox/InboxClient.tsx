"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { conversationsApi } from "@/lib/api";

export type Conversation = {
  id: string;
  contactId: string;
  channel: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS";
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  unreadCount?: number;
  lastMessageAt?: string;
  contact?: { name?: string; phone?: string; email?: string };
  lastMessage?: { text?: string };
};

type Message = {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  text?: string;
  status?: string;
  createdAt?: string;
};

const STATUS_TABS: Array<Conversation["status"]> = [
  "OPEN",
  "CLOSED",
  "ARCHIVED",
];

const LIMIT = 50;

function getApiError(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response
    ?.data?.message ?? "Something went wrong.";
}

export function InboxClient({
  initialConversations,
  workspaceId,
}: {
  initialConversations: Conversation[];
  workspaceId: string;
}) {
  const [status, setStatus] = useState<Conversation["status"]>("OPEN");
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(
    initialConversations.length ? initialConversations.at(-1)?.id ?? null : null
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const fetchConversations = useCallback(async (
    nextStatus = status,
    nextCursor?: string | null,
    append = false
  ) => {
    setListLoading(true);
    setListError(null);
    try {
      const data = (await conversationsApi.list({
        status: nextStatus,
        limit: LIMIT,
        cursor: nextCursor || undefined,
      })) as Conversation[];
      setConversations((prev) => (append ? [...prev, ...data] : data));
      setCursor(data.length ? data.at(-1)?.id ?? null : null);
      if (!append && data.length) {
        setSelectedId((current) => current ?? data[0].id);
      }
      if (!append && !data.length) {
        setSelectedId(null);
      }
    } catch (error: unknown) {
      setListError(getApiError(error) || "Failed to load conversations.");
    } finally {
      setListLoading(false);
    }
  }, [status]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setMessageLoading(true);
    setMessageError(null);
    try {
      const data = (await conversationsApi.messages(
        conversationId
      )) as Message[];
      setMessages(data);
    } catch (error: unknown) {
      setMessageError(getApiError(error) || "Failed to load messages.");
    } finally {
      setMessageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [fetchMessages, selectedId]);

  useEffect(() => {
    fetchConversations(status, null, false);
  }, [fetchConversations, status]);

  useEffect(() => {
    if (!workspaceId) return;
    const source = new EventSource(`/api/sse/workspace/${workspaceId}`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === "MESSAGE_CREATED") {
          fetchConversations(status, null, false);
          if (selectedId) {
            fetchMessages(selectedId);
          }
        }
        if (payload?.type === "CONVERSATION_UPDATED") {
          fetchConversations(status, null, false);
        }
      } catch {
        // ignore malformed SSE payloads
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [fetchConversations, fetchMessages, selectedId, status, workspaceId]);

  const handleSend = async () => {
    if (!selectedConversation || !draft.trim()) return;
    setSending(true);
    try {
      await conversationsApi.sendMessage({
        contactId: selectedConversation.contactId,
        text: draft.trim(),
        idempotencyKey:
          typeof crypto !== "undefined" ? crypto.randomUUID() : undefined,
        channel: selectedConversation.channel,
      });
      setDraft("");
      await fetchMessages(selectedConversation.id);
      await fetchConversations(status, null, false);
    } catch (error: unknown) {
      setMessageError(getApiError(error) || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
      <div className="card h-full bg-base-200 shadow-sm">
        <div className="card-body p-3">
          <div className="flex items-center justify-between">
            <h2 className="card-title text-lg">Conversations</h2>
            {listLoading && <span className="loading loading-spinner" />}
          </div>
          <div role="tablist" className="tabs tabs-box mt-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                className={`tab ${status === tab ? "tab-active" : ""}`}
                onClick={() => setStatus(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {listError && (
            <div role="alert" className="alert alert-error mt-3">
              <span>{listError}</span>
            </div>
          )}

          {!listLoading && !conversations.length && !listError && (
            <div className="mt-4 text-sm text-base-content/60">
              No conversations for this filter.
            </div>
          )}

          <div className="mt-3 flex-1 overflow-y-auto pr-1">
            <ul className="space-y-2">
              {conversations.map((conversation) => {
                const isActive = conversation.id === selectedId;
                const title =
                  conversation.contact?.name ||
                  conversation.contact?.phone ||
                  conversation.contact?.email ||
                  "Unknown contact";
                const subtitle = conversation.lastMessage?.text || "No messages";
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(conversation.id)}
                      className={`flex w-full flex-col gap-1 rounded-xl border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-primary bg-primary/10"
                          : "border-base-300 bg-base-100 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate font-medium">{title}</span>
                        {conversation.unreadCount ? (
                          <span className="badge badge-primary badge-sm">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <span className="truncate text-xs text-base-content/60">
                        {subtitle}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-3">
            <button
              type="button"
              className="btn btn-ghost btn-sm w-full"
              onClick={() => fetchConversations(status, cursor, true)}
              disabled={!cursor || listLoading}
            >
              Load more
            </button>
          </div>
        </div>
      </div>

      <div className="card h-full bg-base-200 shadow-sm">
        <div className="card-body flex h-full flex-col p-3">
          <div className="flex items-center justify-between">
            <h2 className="card-title text-lg">Messages</h2>
            {messageLoading && <span className="loading loading-spinner" />}
          </div>

          {messageError && (
            <div role="alert" className="alert alert-error mt-3">
              <span>{messageError}</span>
            </div>
          )}

          {!selectedConversation && (
            <div className="mt-6 text-sm text-base-content/60">
              Select a conversation to view messages.
            </div>
          )}

          {!!selectedConversation && !messageLoading && !messages.length && (
            <div className="mt-6 text-sm text-base-content/60">
              No messages yet. Send the first one.
            </div>
          )}

          <div className="mt-3 flex-1 overflow-y-auto space-y-3 pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat ${
                  message.direction === "OUTBOUND" ? "chat-end" : "chat-start"
                }`}
              >
                <div className="chat-bubble chat-bubble-primary">
                  {message.text || "Unsupported message type"}
                </div>
                <div className="chat-footer text-xs text-base-content/60">
                  {message.status || "Sent"}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Type a message..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSend();
                }
              }}
              disabled={!selectedConversation || sending}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSend}
              disabled={!draft.trim() || !selectedConversation || sending}
            >
              {sending ? <span className="loading loading-spinner" /> : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
