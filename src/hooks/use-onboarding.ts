"use client";

import { useQuery } from "@tanstack/react-query";
import { onboardingApi } from "@/lib/api";

export const onboardingKeys = {
  all: ["onboarding"] as const,
  wabaOwned: () => [...onboardingKeys.all, "wabaOwned"] as const,
  wabaClient: () => [...onboardingKeys.all, "wabaClient"] as const,
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
