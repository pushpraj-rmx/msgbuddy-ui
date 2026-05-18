"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MessageSquare, User, ArrowRight } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { contactsApi, conversationsApi } from "@/lib/api";
import { SHORTCUT_EVENTS } from "@/lib/shortcuts";
import type { Contact } from "@/lib/types";

type ConversationSearchResult = {
  id: string;
  contact?: { name?: string; phone?: string; email?: string };
  lastMessage?: { text?: string };
};

export function GlobalSearch({
  variant = "desktop",
}: {
  /** Desktop bar vs mobile overlay — only the matching instance reacts to Ctrl/Cmd+K. */
  variant?: "desktop" | "mobile";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebouncedValue(query.trim(), 250);
  const inputId =
    variant === "mobile" ? "global-search-input-mobile" : "global-search-input";

  useEffect(() => {
    const onOpenFromShortcut = () => {
      if (typeof window === "undefined") return;
      const wide = window.matchMedia("(min-width: 768px)").matches;
      if (variant === "desktop" && !wide) return;
      if (variant === "mobile" && wide) return;
      setOpen(true);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    };
    window.addEventListener(SHORTCUT_EVENTS.OPEN_GLOBAL_SEARCH, onOpenFromShortcut);
    return () =>
      window.removeEventListener(SHORTCUT_EVENTS.OPEN_GLOBAL_SEARCH, onOpenFromShortcut);
  }, [variant]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setQuery("");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  // ⌘K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchQuery = useQuery({
    queryKey: ["global-search", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const [contactsRes, conversationsRes] = await Promise.all([
        contactsApi.list({
          search: debounced,
          limit: 6,
          sort: "lastMessageAt",
          order: "desc",
          include: "tags",
        }),
        conversationsApi.list({
          status: "OPEN",
          search: debounced,
          limit: 6,
          sort: "lastMessageAt",
        }) as Promise<ConversationSearchResult[]>,
      ]);
      return {
        contacts: contactsRes.contacts ?? [],
        conversations: conversationsRes ?? [],
      };
    },
  });

  const contacts = searchQuery.data?.contacts ?? [];
  const conversations = searchQuery.data?.conversations ?? [];
  const hasResults = contacts.length > 0 || conversations.length > 0;

  // Trigger button (shown when closed)
  if (!open && variant === "desktop") {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="input input-bordered input-sm gap-2 text-base-content/50 font-normal cursor-pointer"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <span className="op-kbd ml-auto">⌘K</span>
      </button>
    );
  }

  if (!open && variant === "mobile") {
    return null;
  }

  // Command palette modal
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-base-content/40" />

      {/* Palette */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
        <div
          ref={containerRef}
          className="w-full max-w-lg mx-4 overflow-hidden rounded-box border border-base-300 bg-base-200 shadow-lg"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-base-300 px-4">
            <Search className="h-5 w-5 shrink-0 text-base-content/40" />
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              placeholder="Search contacts, conversations..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-base-content/40"
              autoFocus
            />
            <span className="op-kbd shrink-0">ESC</span>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {debounced.length < 2 ? (
              <div className="p-6 text-center text-sm text-base-content/40">
                Type to search contacts and conversations
              </div>
            ) : searchQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 p-6">
                <span className="loading loading-spinner loading-sm" />
                <span className="text-sm text-base-content/50">Searching...</span>
              </div>
            ) : !hasResults ? (
              <div className="px-6 py-8 text-center">
                <span className="op-label mb-2 block">no results</span>
                <p className="text-[0.8125rem] text-base-content/55">
                  Nothing matched &ldquo;{debounced}&rdquo;
                </p>
              </div>
            ) : (
              <div className="py-2">
                {conversations.length > 0 && (
                  <div>
                    <p className="op-label px-4 py-2">
                      Conversations
                    </p>
                    {conversations.slice(0, 4).map((conversation) => {
                      const name =
                        conversation.contact?.name ||
                        conversation.contact?.phone ||
                        conversation.contact?.email ||
                        "Conversation";
                      return (
                        <Link
                          key={conversation.id}
                          href={`/inbox?conversationId=${conversation.id}&focus=reply`}
                          onClick={() => {
                            setOpen(false);
                            setQuery("");
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-base-200 transition-colors"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-100 text-base-content/70">
                            <MessageSquare className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{name}</p>
                            <p className="truncate text-xs text-base-content/50">
                              {conversation.lastMessage?.text || "Open conversation"}
                            </p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-base-content/30" />
                        </Link>
                      );
                    })}
                  </div>
                )}

                {contacts.length > 0 && (
                  <div>
                    {conversations.length > 0 && <div className="border-t border-base-300" />}
                    <p className="op-label px-4 py-2">
                      Contacts
                    </p>
                    {contacts.slice(0, 4).map((contact: Contact) => (
                      <Link
                        key={contact.id}
                        href={`/people/contacts/${contact.id}`}
                        onClick={() => {
                          setOpen(false);
                          setQuery("");
                        }}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-base-200 transition-colors"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-100 text-base-content/70">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {contact.name || contact.phone || contact.email || "Contact"}
                          </p>
                          <p className="truncate text-xs text-base-content/50">
                            {contact.email || contact.phone}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-base-content/30" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-base-300 px-4 py-2">
            <span className="text-xs text-base-content/40">
              {hasResults
                ? `${conversations.length + contacts.length} results`
                : "Search by name, email, or phone"}
            </span>
            <div className="flex items-center gap-1.5 font-mono-op text-[0.625rem] text-base-content/40">
              <span className="op-kbd">↑↓</span>
              <span>navigate</span>
              <span className="op-kbd ml-1">↵</span>
              <span>open</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
