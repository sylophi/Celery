import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FolderState, ModsSnapshot } from "@shared/schemas";
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
    mutationFn: ({
      fileName,
      favorite,
    }: {
      fileName: string;
      favorite: boolean;
    }) => window.api.mods.setFavorite(fileName, favorite),
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

// Mutations take an UPDATER over the freshest cached state, not a
// snapshot: building the payload from a component prop races — a second
// click before the first write's refetch lands would clobber it, and a
// click before the initial load would wipe the file with EMPTY state.
export function useSaveFolderState(folder: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (update: (state: FolderState) => FolderState) => {
      const key = queryKeys.folderState(folder ?? "");
      const current = queryClient.getQueryData<FolderState>(key);
      if (!folder || current === undefined) {
        throw new Error("folder state not loaded yet");
      }
      const next = update(current);
      await window.api.folderState.write(folder, next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.folderState(folder ?? ""), next);
    },
  });
}
