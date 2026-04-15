"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
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

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !open) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

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

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <label className="input input-bordered flex h-12 w-full items-center gap-2 rounded-full border-base-300 bg-base-200/60 text-sm transition-colors focus-within:border-primary/40 focus-within:bg-base-100 ">
        <Search className="h-4 w-4 shrink-0 text-base-content/40" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          placeholder="Search contacts, conversations…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          className="grow bg-transparent placeholder:text-base-content/40"
        />
        <kbd className="kbd kbd-sm hidden shrink-0 text-base-content/30 sm:inline">⌘K</kbd>
      </label>

      {open && debounced.length >= 2 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl">
          {searchQuery.isLoading ? (
            <div className="p-3 text-sm text-base-content/65">Searching...</div>
          ) : contacts.length === 0 && conversations.length === 0 ? (
            <div className="p-3 text-sm text-base-content/65">No matches found.</div>
          ) : (
            <div className="space-y-2">
              {conversations.length > 0 ? (
                <section className="space-y-1">
                  <p className="px-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                    Conversations
                  </p>
                  {conversations.slice(0, 4).map((conversation) => {
                    const name =
                      conversation.contact?.name ||
                      conversation.contact?.phone || 2
                    conversation.contact?.email ||
                      "Conversation";
                    return (
                      <Link
                        key={conversation.id}
                        href={`/inbox?conversationId=${conversation.id}&focus=reply`}
                        onClick={() => setOpen(false)}
                        className="block rounded-box border border-transparent px-2 py-2 hover:border-base-300 hover:bg-base-200"
                      >
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="truncate text-xs text-base-content/60">
                          {conversation.lastMessage?.text || "Open conversation"}
                        </p>
                      </Link>
                    );
                  })}
                </section>
              ) : null}

              {contacts.length > 0 ? (
                <section className="space-y-1">
                  <p className="px-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                    Contacts
                  </p>
                  {contacts.slice(0, 4).map((contact: Contact) => (
                    <Link
                      key={contact.id}
                      href={`/people/contacts/${contact.id}`}
                      onClick={() => setOpen(false)}
                      className="block rounded-box border border-transparent px-2 py-2 hover:border-base-300 hover:bg-base-200"
                    >
                      <p className="truncate text-sm font-medium">
                        {contact.name || contact.phone || contact.email || "Contact"}
                      </p>
                      <p className="truncate text-xs text-base-content/60">
                        {contact.email || contact.phone}
                      </p>
                    </Link>
                  ))}
                </section>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
