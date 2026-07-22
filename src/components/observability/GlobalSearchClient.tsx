"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useObsSearch } from "@/hooks/use-observability";
import type { ObsSearchMatch } from "@/lib/observability-types";
import { IdCell, ObsHeader } from "./obs-ui";
import { TimelineView } from "./MessageTimelineClient";

function uiLinkFor(match: ObsSearchMatch): string | null {
  switch (match.type) {
    case "message":
      return `/platform/observability/messages/${match.id}`;
    case "webhook":
      return `/platform/observability/webhooks`;
    case "provider_request":
      return `/platform/observability/provider-requests`;
    default:
      return null;
  }
}

export function GlobalSearchClient() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const { data, isFetching, isError, error } = useObsSearch(query);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(input.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      <ObsHeader
        title="Global operational search"
        subtitle="Resolve any identifier to its trace — message id, wamid, phone, correlation id, conversation / workspace id, or webhook reference."
      />

      <form onSubmit={onSubmit} className="join w-full max-w-2xl">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="wamid.HBg… / +9198… / cku… / correlation uuid"
          className="input input-bordered join-item w-full font-mono text-sm"
          autoFocus
        />
        <button type="submit" className="btn btn-primary join-item">
          Search
        </button>
      </form>

      {query && isFetching ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner" />
        </div>
      ) : null}

      {isError ? (
        <div className="alert alert-error">
          <span>{(error as Error)?.message ?? "Search failed"}</span>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="text-sm opacity-60">
            Interpreted <span className="font-mono">{data.query}</span> as{" "}
            <span className="badge badge-ghost badge-sm">
              {data.identifierType}
            </span>{" "}
            — {data.matches.length} match
            {data.matches.length === 1 ? "" : "es"}
          </div>

          {data.matches.length > 0 ? (
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Summary</th>
                    <th>Workspace</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.matches.map((m) => {
                    const link = uiLinkFor(m);
                    return (
                      <tr key={`${m.type}-${m.id}`}>
                        <td>
                          <span className="badge badge-ghost badge-sm">
                            {m.type}
                          </span>
                        </td>
                        <td className="max-w-md truncate" title={m.summary}>
                          {m.summary}
                        </td>
                        <td>
                          <IdCell value={m.workspaceId} />
                        </td>
                        <td className="text-right">
                          {link ? (
                            <Link href={link} className="btn btn-ghost btn-xs">
                              Open →
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm opacity-60">No matches.</p>
          )}

          {data.timeline ? (
            <div className="mt-2">
              <TimelineView timeline={data.timeline} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
