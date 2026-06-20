"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/api";
import { selectWorkspaceAction } from "@/app/actions/auth";
import { setAccessToken } from "@/lib/auth";

export function WorkspaceSwitcher({
  currentWorkspaceId,
  currentName,
}: {
  currentWorkspaceId: string;
  currentName: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["user-workspaces"],
    queryFn: () => workspaceApi.listUserWorkspaces(),
  });

  const onChange = (id: string) => {
    if (id === currentWorkspaceId) return;
    setError(null);
    startTransition(async () => {
      const result = await selectWorkspaceAction(id);
      if (!result.success) {
        setError(result.error || "Could not switch workspace.");
        return;
      }
      if (result.accessToken) {
        setAccessToken(result.accessToken, {
          expiresInSeconds: result.expiresIn,
        });
      }
      queryClient.clear();
      router.refresh();
    });
  };

  if (isLoading) {
    return (
      <div className="w-full min-w-0 animate-pulse truncate text-sm text-base-content/50">
        Loading…
      </div>
    );
  }

  if (workspaces.length === 0) {
    return null;
  }

  if (workspaces.length === 1) {
    return (
      <div
        className="w-full min-w-0 truncate text-sm font-medium text-base-content/80"
        title={currentName}
      >
        {currentName}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5">
      <label className="sr-only" htmlFor="workspace-switcher">
        Workspace
      </label>
      <select
        id="workspace-switcher"
        className="select select-bordered select-sm h-9 min-h-9 w-full max-w-full py-0 text-sm"
        value={currentWorkspaceId}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value)}
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-error">{error}</p> : null}
    </div>
  );
}
