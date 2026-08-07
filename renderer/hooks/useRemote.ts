import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RemoteProgress } from "@shared/schemas";
import { queryKeys } from "@/lib/queryKeys";

// Everything remote is best-effort: no retry storms, generous stale
// times (the server itself only refreshes every ~30 minutes, and the
// main process caches on disk), and errors surface as "no data".

export function useRemoteOverview(enabled = true) {
  return useQuery({
    queryKey: queryKeys.remoteOverview,
    queryFn: () => window.api.remote.overview(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useRemoteModInfo(name: string | undefined) {
  return useQuery({
    queryKey: queryKeys.remoteModInfo(name ?? ""),
    queryFn: () => window.api.remote.modInfo(name!),
    enabled: name !== undefined,
    staleTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useResolveMissing(names: string[]) {
  const sorted = names.toSorted();
  return useQuery({
    queryKey: queryKeys.remoteMissing(sorted),
    queryFn: () => window.api.remote.resolveMissing(sorted),
    enabled: sorted.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

function invalidateAfterFilesChanged(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.mods });
  void queryClient.invalidateQueries({ queryKey: queryKeys.remoteOverview });
  void queryClient.invalidateQueries({ queryKey: ["remote", "missing"] });
}

export function useInstallMods() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => window.api.remote.install(names),
    // Files changed on disk regardless of per-mod failures — resync.
    onSettled: () => invalidateAfterFilesChanged(queryClient),
  });
}

export function useUpdateMod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileName: string) => window.api.remote.update(fileName),
    onSettled: () => invalidateAfterFilesChanged(queryClient),
  });
}

// Live download progress, keyed by mod Name. Entries linger in their
// final phase ("done"/"error") until the next download of that mod.
export function useRemoteProgress(): Map<string, RemoteProgress> {
  const [progress, setProgress] = useState<Map<string, RemoteProgress>>(
    () => new Map(),
  );
  useEffect(() => {
    return window.api.remote.onProgress((payload) => {
      setProgress((prev) => {
        const next = new Map(prev);
        next.set(payload.id, payload);
        return next;
      });
    });
  }, []);
  return progress;
}
