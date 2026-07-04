"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commerceApi } from "@/lib/api";
import type {
  CommerceCredentialStatus,
  ProductCatalog,
} from "@/lib/types";

export type CommerceProductsParams = {
  catalogId?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export const commerceKeys = {
  all: ["commerce"] as const,
  credential: () => [...commerceKeys.all, "credential"] as const,
  catalogs: () => [...commerceKeys.all, "catalogs"] as const,
  syncLogs: (catalogId: string) =>
    [...commerceKeys.all, "sync-logs", catalogId] as const,
  products: () => [...commerceKeys.all, "products"] as const,
  productList: (params: CommerceProductsParams) =>
    [...commerceKeys.products(), params] as const,
  productDetail: (id: string) =>
    [...commerceKeys.all, "product", id] as const,
};

const defaultProductParams: CommerceProductsParams = {
  page: 1,
  limit: 25,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useCommerceCredential() {
  return useQuery<CommerceCredentialStatus>({
    queryKey: commerceKeys.credential(),
    queryFn: () => commerceApi.getCredentialStatus(),
  });
}

export function useCatalogs(options?: { enabled?: boolean }) {
  return useQuery<ProductCatalog[]>({
    queryKey: commerceKeys.catalogs(),
    queryFn: () => commerceApi.listCatalogs(),
    enabled: options?.enabled !== false,
  });
}

export function useCatalogSyncLogs(
  catalogId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: commerceKeys.syncLogs(catalogId ?? ""),
    queryFn: () => commerceApi.catalogSyncLogs(catalogId!),
    enabled: !!catalogId && options?.enabled !== false,
  });
}

export function useProducts(params: CommerceProductsParams = {}) {
  const merged = { ...defaultProductParams, ...params };
  return useQuery({
    queryKey: commerceKeys.productList(merged),
    queryFn: () => commerceApi.listProducts(merged),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useConnectCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { accessToken: string; businessId?: string }) =>
      commerceApi.connectCredential(data),
    onSuccess: (data) => {
      qc.setQueryData(commerceKeys.credential(), data);
      qc.invalidateQueries({ queryKey: commerceKeys.catalogs() });
    },
  });
}

export function useDisconnectCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => commerceApi.disconnectCredential(),
    onSuccess: (data) => {
      qc.setQueryData(commerceKeys.credential(), data);
      qc.invalidateQueries({ queryKey: commerceKeys.catalogs() });
      qc.invalidateQueries({ queryKey: commerceKeys.products() });
    },
  });
}

export function useRefreshCatalogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => commerceApi.refreshCatalogs(),
    onSuccess: (data) => {
      qc.setQueryData(commerceKeys.catalogs(), data);
    },
  });
}

export function useConnectCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commerceApi.connectCatalog(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commerceKeys.catalogs() });
    },
  });
}

export function useSyncCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commerceApi.syncCatalog(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: commerceKeys.catalogs() });
      qc.invalidateQueries({ queryKey: commerceKeys.syncLogs(id) });
      qc.invalidateQueries({ queryKey: commerceKeys.products() });
    },
  });
}
