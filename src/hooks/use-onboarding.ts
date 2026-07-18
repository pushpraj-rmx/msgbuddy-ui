"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onboardingApi } from "@/lib/api";
import { platformKeys } from "@/hooks/use-platform";

export const onboardingKeys = {
  all: ["onboarding"] as const,
  wabaOwned: () => [...onboardingKeys.all, "wabaOwned"] as const,
  wabaClient: () => [...onboardingKeys.all, "wabaClient"] as const,
  sharingInfo: () => [...onboardingKeys.all, "sharingInfo"] as const,
};

export function useOwnedWabas() {
  return useQuery({
    queryKey: onboardingKeys.wabaOwned(),
    queryFn: () => onboardingApi.listOwnedWabas(),
  });
}

export function useClientWabas() {
  return useQuery({
    queryKey: onboardingKeys.wabaClient(),
    queryFn: () => onboardingApi.listClientWabas(),
  });
}

/** Our partner business id + Graph version for the "share your WABA" guidance. */
export function useSharingInfo() {
  return useQuery({
    queryKey: onboardingKeys.sharingInfo(),
    queryFn: () => onboardingApi.getSharingInfo(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Re-run discovery after a customer shares a WABA — refetch the WABA lists AND
 * the connected-businesses list so a freshly-shared account appears without a
 * full reload.
 */
export function useRecheckOnboarding() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
    void queryClient.invalidateQueries({
      queryKey: platformKeys.connectedClientBusinesses(),
    });
  }, [queryClient]);
}
