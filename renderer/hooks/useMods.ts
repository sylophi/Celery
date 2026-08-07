import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModsSnapshot } from "@shared/schemas";
import { buildIndex } from "@shared/graph";
import { queryKeys } from "@/lib/queryKeys";

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: () => window.api.config.read(),
  });
}

export function useMods() {
  return useQuery({
    queryKey: queryKeys.mods,
    queryFn: () => window.api.mods.scan(),
    // Scans hit the manifest cache after the first run, but keep manual
    // control: rescan on demand, not on every focus.
    refetchOnWindowFocus: false,
  });
}

// Plain derivation — React Compiler memoizes it on `snapshot` identity.
export function useModIndex(snapshot: ModsSnapshot | undefined) {
  return snapshot ? buildIndex(snapshot) : null;
}

export function useSetEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: { fileName: string; enabled: boolean }[]) =>
      window.api.mods.setEnabled(changes),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(queryKeys.mods, snapshot);
    },
  });
}

export function useSetFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileName, favorite }: { fileName: string; favorite: boolean }) =>
      window.api.mods.setFavorite(fileName, favorite),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(queryKeys.mods, snapshot);
    },
  });
}

export function useFolderState(folder: string | undefined) {
  return useQuery({
    queryKey: queryKeys.folderState(folder ?? ""),
    queryFn: () => window.api.folderState.read(folder!),
    enabled: Boolean(folder),
  });
}

export function useSaveFolderState(folder: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (state: Parameters<typeof window.api.folderState.write>[1]) =>
      window.api.folderState.write(folder!, state),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.folderState(folder ?? ""),
      });
    },
  });
}
