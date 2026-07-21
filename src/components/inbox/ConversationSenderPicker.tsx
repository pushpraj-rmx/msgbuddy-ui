"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { conversationsApi, whatsappApi } from "@/lib/api";

/**
 * Per-conversation "Send from" control. WhatsApp conversations are sticky to
 * the number they started on; this lets the user move a specific chat onto
 * another connected number (e.g. a newly-set default). Renders nothing unless
 * the workspace has ≥2 active WhatsApp numbers.
 *
 * WhatsApp's 24h reply window is per-number — if the customer's open session is
 * on the old number, free-form replies from the new one need a template until
 * they message it. We surface that as a hint rather than blocking.
 */
export function ConversationSenderPicker({
  conversationId,
  currentChannelAccountId,
  channel,
  onChanged,
}: {
  conversationId: string;
  currentChannelAccountId?: string | null;
  channel?: string;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const connectionsQuery = useQuery({
    queryKey: ["whatsapp", "connections"],
    queryFn: () => whatsappApi.listConnections(),
    staleTime: 60_000,
    enabled: channel === "WHATSAPP",
  });

  const activeNumbers = useMemo(
    () =>
      (connectionsQuery.data ?? []).filter(
        (c) => c.status === "ACTIVE" && c.channelAccountId,
      ),
    [connectionsQuery.data],
  );

  const setSenderMutation = useMutation({
    mutationFn: (cloudApiAccountId: string) =>
      conversationsApi.setSendingNumber(conversationId, cloudApiAccountId),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onChanged?.();
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? (e instanceof Error ? e.message : "Couldn't change the number.");
      setError(String(msg));
    },
  });

  // Only meaningful with a choice to make.
  if (channel !== "WHATSAPP" || activeNumbers.length < 2) return null;

  const current = activeNumbers.find(
    (c) => c.channelAccountId === currentChannelAccountId,
  );
  // Templates and 24h sessions are per-WABA; warn when switching across WABAs.
  const wabas = new Set(activeNumbers.map((n) => n.wabaId).filter(Boolean));
  const crossWaba = wabas.size > 1;

  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-200 text-base-content/50">
        <span aria-hidden className="text-[0.7rem]">⇅</span>
      </div>
      <div className="min-w-0 flex-1">
        <label className="block text-[0.625rem] uppercase tracking-wide text-base-content/40">
          Sending from
        </label>
        <select
          className="select select-bordered select-xs mt-0.5 w-full max-w-[15rem] font-mono-op text-[0.75rem]"
          value={current?.id ?? ""}
          disabled={setSenderMutation.isPending}
          onChange={(e) => {
            if (e.target.value) setSenderMutation.mutate(e.target.value);
          }}
        >
          {!current ? <option value="">Select a number…</option> : null}
          {activeNumbers.map((n) => (
            <option key={n.id} value={n.id}>
              {n.displayPhoneNumber ?? n.phoneNumberId}
              {n.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>
        {setSenderMutation.isPending ? (
          <p className="mt-1 text-[0.625rem] text-base-content/40">Updating…</p>
        ) : error ? (
          <p className="mt-1 text-[0.625rem] text-error">{error}</p>
        ) : crossWaba ? (
          <p className="mt-1 text-[0.625rem] text-warning">
            ⚠ These numbers are on different WhatsApp Business Accounts.
            Templates approved on one WABA don&apos;t exist on another, and the
            24h reply window doesn&apos;t carry over — after switching, only
            templates approved on the chosen number&apos;s WABA will send.
          </p>
        ) : (
          <p className="mt-1 text-[0.625rem] text-base-content/40">
            Replies + new sends use this number. If the customer&apos;s 24h
            window is on another number, a template may be needed.
          </p>
        )}
      </div>
    </div>
  );
}
