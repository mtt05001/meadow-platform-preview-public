"use client";

import { useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

/**
 * Shared hook for syncing GHL client data.
 *
 * - Auto-syncs on first mount (the sync endpoint has a 1-min TTL guard)
 * - Exposes `sync()` and `isSyncing` for manual refresh buttons
 * - Invalidates all dependent query keys after sync
 */
export function useClientSync() {
  const queryClient = useQueryClient();
  const didAutoSync = useRef(false);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message?: string }>(
        "/api/clients/sync",
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["intakes"] });
      queryClient.invalidateQueries({ queryKey: ["mission-control"] });
    },
  });

  useEffect(() => {
    if (didAutoSync.current) return;
    didAutoSync.current = true;
    mutation.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sync: () => mutation.mutate(),
    isSyncing: mutation.isPending,
    lastResult: mutation.data,
    error: mutation.error,
  };
}
