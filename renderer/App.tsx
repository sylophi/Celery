import { useEffect, useRef, useState } from "react";
import { FolderOpenIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  dependentClosure,
  findOrphans,
  planDisable,
  planEnable,
} from "@shared/graph";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, type PendingAction } from "@/components/ConfirmDialog";
import {
  DetailPanel,
  EmptyPanel,
  GhostPanel,
  type PanelPlacement,
} from "@/components/DetailPanel";
import { GraphView } from "@/components/graph/GraphView";
import { ghostName, isGhostId } from "@/components/graph/layout";
import { OrphanDialog } from "@/components/OrphanCleanup";
import { UpdateDialog, type Outdated } from "@/components/UpdateReview";
import { GridView } from "@/components/browse/GridView";
import { ListView } from "@/components/browse/ListView";
import { isSortMode, type SortMode } from "@/components/browse/sort";
import { SettingsDialog } from "@/components/SettingsDialog";
import { StatusPill, type Status } from "@/components/StatusPill";
import { StatusBar, Toolbar, type View } from "@/components/Toolbar";
import { EMPTY_FOLDER_STATE } from "@shared/schemas";
import {
  useConfig,
  useFolderState,
  useModIndex,
  useMods,
  useRemoveMods,
  useSetEnabled,
} from "@/hooks/useMods";
import {
  useRemoteOverview,
  useRemoteProgress,
  useUpdateMods,
} from "@/hooks/useRemote";
import { queryKeys } from "@/lib/queryKeys";
import { displayName, dragRegion } from "@/lib/utils";

const VIEW_STORAGE_KEY = "celery.view";
const SORT_STORAGE_KEY = "celery.sortMode";

export function App() {
  const queryClient = useQueryClient();
  const configQuery = useConfig();
  const modsQuery = useMods();
  const index = useModIndex(modsQuery.data);
  const folder = configQuery.data?.modsFolder;
  const folderStateQuery = useFolderState(folder);
  const folderState = folderStateQuery.data ?? EMPTY_FOLDER_STATE;
  const setEnabled = useSetEnabled();
  const removeMods = useRemoveMods();
  const updateMods = useUpdateMods();
  const progress = useRemoteProgress();
  const overview = useRemoteOverview(Boolean(folder));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === "graph" || stored === "list" ? stored : "grid";
  });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>(() => {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    return isSortMode(stored) ? stored : "name";
  });
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const changeView = (next: View) => {
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  };
  const changeSort = (next: SortMode) => {
    setSort(next);
    localStorage.setItem(SORT_STORAGE_KEY, next);
  };

  const orphans = index ? new Set(findOrphans(index)) : new Set<string>();
  const updates = new Set(
    Object.entries(overview.data?.byFile ?? {})
      .filter(([, remote]) => remote.updateAvailable)
      .map(([fileName]) => fileName),
  );
  // How each zip maps onto GameBanana: its category, whether a newer
  // build exists, and the mod Name the artwork is fetched under.
  const remoteOf = (fileName: string) => overview.data?.byFile[fileName];

  // Which mods count as "dependencies" (vs top-level mods you play):
  // hard dependents only (a mod that is merely optionally referenced
  // stays top-level), with per-mod user overrides on top.
  const dependencySet = new Set<string>();
  for (const file of index?.files ?? []) {
    const byDefault = (index?.dependents.get(file.fileName)?.size ?? 0) > 0;
    const section =
      folderState.sectionOverrides[file.fileName] ??
      (byDefault ? "dependency" : "mod");
    if (section === "dependency") dependencySet.add(file.fileName);
  }

  // A search narrows what the views SHOW, not what a focused mod may
  // reach: searching "cat" and opening Cat_Isle should still lay out its
  // whole dependency tree, so the graph gets both sets.
  const query = search.trim().toLowerCase();
  const scope = index?.files ?? [];
  const visible = scope.filter(
    (file) =>
      query === "" ||
      file.fileName.toLowerCase().includes(query) ||
      file.entries.some((entry) => entry.name.toLowerCase().includes(query)),
  );

  // `/` focuses search, Escape clears the selection. Skipped while
  // typing or while a dialog ([data-popup]) is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [data-popup]")) return;
      // A dialog can be open while focus sits outside it (opened by
      // mouse click); Escape must close only the dialog, not also
      // clear the selection behind it.
      if (document.querySelector("[data-popup]")) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const apply = (
    changes: { fileName: string; enabled: boolean }[],
    message: string,
  ) => {
    setEnabled.mutate(changes, {
      onSuccess: () =>
        setStatus((prev) => ({
          text: message,
          kind: "ok",
          nonce: (prev?.nonce ?? 0) + 1,
        })),
      // A failed write (locked blacklist.txt with the game running,
      // permissions) must be visible, not a toggle that silently
      // snaps back.
      onError: (error) =>
        setStatus((prev) => ({
          text: `couldn't write blacklist: ${error instanceof Error ? error.message : String(error)}`,
          kind: "error",
          nonce: (prev?.nonce ?? 0) + 1,
        })),
    });
  };

  // Dependency-aware toggling. Enabling pulls in the disabled part of
  // the hard-dep closure; disabling takes down everything enabled that
  // would break without it. Cascades apply immediately by default (the
  // status pill reports what happened) unless the confirm-cascades
  // setting routes them through the preview dialog first.
  const requestToggle = (fileName: string, enable: boolean) => {
    if (!index) return;
    const label = displayName(fileName);
    const confirm = configQuery.data?.confirmCascades ?? false;
    const run = (
      changes: { fileName: string; enabled: boolean }[],
      message: string,
      dialog: Omit<PendingAction, "changes" | "message">,
    ) => {
      if (changes.length === 0) return;
      if (confirm && dialog.sections.some((s) => s.items.length > 0)) {
        setPending({ ...dialog, changes, message });
      } else {
        apply(changes, message);
      }
    };

    if (enable) {
      const plan = planEnable(index, [fileName]);
      const changes = [...plan.targets, ...plan.cascade].map((f) => ({
        fileName: f,
        enabled: true,
      }));
      run(
        changes,
        plan.cascade.length > 0
          ? `enabled ${label} + ${plan.cascade.length} dependencies`
          : `enabled ${label}`,
        {
          title: "enable dependencies too?",
          sections: [
            { label: "needs these disabled mods", items: plan.cascade },
          ],
          confirmLabel: `enable ${changes.length} mods`,
        },
      );
      return;
    }

    // `planDisable` reports this mod as kept when something enabled
    // still needs it; disabling it anyway means taking those dependents
    // down as well.
    const plan = planDisable(index, [fileName]);
    if (plan.targets.length === 0 && plan.kept.length === 0) return;
    const forced = [...dependentClosure(index, [fileName])]
      .filter((f) => index.byFileName.get(f)?.enabled)
      .toSorted();
    const dependents = forced.filter((f) => f !== fileName);
    run(
      forced.map((f) => ({ fileName: f, enabled: false })),
      dependents.length > 0
        ? `disabled ${label} + ${dependents.length} dependents`
        : `disabled ${label}`,
      {
        title: "disable dependents too?",
        sections: [{ label: "these enabled mods need it", items: dependents }],
        confirmLabel: `disable ${forced.length} mods`,
      },
    );
  };

  // The grid and the list differ in how they draw a mod, not in what
  // they are drawing.
  const browseProps = {
    files: visible,
    total: scope.length,
    query,
    sort,
    onSort: changeSort,
    orphans,
    updates,
    dependencySet,
    remoteOf,
    selectedId,
    onSelect: setSelectedId,
  };

  const orphanFiles = (index?.files ?? []).filter((f) =>
    orphans.has(f.fileName),
  );
  const outdated: Outdated[] = (index?.files ?? []).flatMap((file) => {
    const remote = remoteOf(file.fileName);
    return remote?.updateAvailable === true ? [{ file, remote }] : [];
  });

  const runUpdate = (fileNames: string[]) => {
    updateMods.mutate(fileNames, {
      onSuccess: (result) => {
        // Only close once everything worked: a failed row has to stay
        // on screen with its reason attached.
        if (result.failed.length === 0) setUpdatesOpen(false);
        setStatus((prev) => ({
          text:
            result.failed.length > 0
              ? `updated ${result.updated.length}, ${result.failed.length} failed`
              : `updated ${result.updated.length} mods`,
          kind: result.failed.length > 0 ? "error" : "ok",
          nonce: (prev?.nonce ?? 0) + 1,
        }));
      },
      onError: (error) =>
        setStatus((prev) => ({
          text: `couldn't update: ${error instanceof Error ? error.message : String(error)}`,
          kind: "error",
          nonce: (prev?.nonce ?? 0) + 1,
        })),
    });
  };

  // Trashing is reported rather than announced: a partial failure (the
  // game holding a zip open) has to be visible, not swallowed.
  const cleanUp = (fileNames: string[], trash: boolean) => {
    setCleanupOpen(false);
    const label = `${fileNames.length} ${fileNames.length === 1 ? "orphan" : "orphans"}`;
    if (!trash) {
      apply(
        fileNames.map((fileName) => ({ fileName, enabled: false })),
        `disabled ${label}`,
      );
      return;
    }
    removeMods.mutate(fileNames, {
      onSuccess: (result) =>
        setStatus((prev) => ({
          text:
            result.failed.length > 0
              ? `trashed ${result.trashed.length}, couldn't remove ${result.failed.length}`
              : `moved ${label} to the trash`,
          kind: result.failed.length > 0 ? "error" : "ok",
          nonce: (prev?.nonce ?? 0) + 1,
        })),
      onError: (error) =>
        setStatus((prev) => ({
          text: `couldn't remove: ${error instanceof Error ? error.message : String(error)}`,
          kind: "error",
          nonce: (prev?.nonce ?? 0) + 1,
        })),
    });
  };

  const selectedFile =
    selectedId && index ? (index.byFileName.get(selectedId) ?? null) : null;
  const selectedGhost =
    selectedId && isGhostId(selectedId) ? ghostName(selectedId) : null;

  // Same panel either way; only where it sits changes.
  const panel = (placement: PanelPlacement) => {
    if (!index) return null;
    if (selectedGhost !== null) {
      return (
        <GhostPanel
          name={selectedGhost}
          index={index}
          placement={placement}
          onSelect={setSelectedId}
          onClose={() => setSelectedId(null)}
        />
      );
    }
    if (selectedFile !== null) {
      return (
        <DetailPanel
          file={selectedFile}
          index={index}
          orphan={orphans.has(selectedFile.fileName)}
          dependencySet={dependencySet}
          folder={folder ?? ""}
          placement={placement}
          onSelect={setSelectedId}
          onClose={() => setSelectedId(null)}
          onToggle={(enable) => requestToggle(selectedFile.fileName, enable)}
        />
      );
    }
    return null;
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {folder ? (
        <>
          <Toolbar
            view={view}
            onView={changeView}
            search={search}
            onSearch={setSearch}
            searchRef={searchRef}
            rescanning={modsQuery.isFetching}
            onRescan={() => {
              // Files may have changed under us, and update-badge state
              // depends on their hashes, so refresh both.
              void queryClient.invalidateQueries({ queryKey: queryKeys.mods });
              void queryClient.invalidateQueries({
                queryKey: queryKeys.remoteOverview,
              });
            }}
            onSettings={() => setSettingsOpen(true)}
          />
          <main className="relative flex min-h-0 flex-1">
            <div className="relative min-w-0 flex-1">
              {modsQuery.isLoading ? (
                <ScanProgress />
              ) : modsQuery.isError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <p className="max-w-md text-xs text-destructive">
                    couldn't read the mods folder:{" "}
                    {modsQuery.error instanceof Error
                      ? modsQuery.error.message
                      : String(modsQuery.error)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void queryClient.invalidateQueries({
                        queryKey: queryKeys.mods,
                      })
                    }
                  >
                    try again
                  </Button>
                </div>
              ) : (
                index &&
                (view === "graph" ? (
                  <GraphView
                    index={index}
                    scope={new Set(scope.map((f) => f.fileName))}
                    visible={new Set(visible.map((f) => f.fileName))}
                    orphans={orphans}
                    dependencySet={dependencySet}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                ) : view === "grid" ? (
                  <GridView {...browseProps} index={index} />
                ) : (
                  <ListView {...browseProps} index={index} />
                ))
              )}
              {view === "graph" && panel("floating")}
            </div>
            {/* Docked beside the browse views rather than over them, and
                held open even with nothing selected so picking a mod
                never reflows the grid behind it. */}
            {view !== "graph" && (
              <aside className="w-72 shrink-0">
                {panel("docked") ?? <EmptyPanel />}
              </aside>
            )}
          </main>
          <StatusBar
            folder={folder}
            total={modsQuery.data?.files.length ?? 0}
            enabled={modsQuery.data?.files.filter((f) => f.enabled).length ?? 0}
            updates={updates.size}
            orphans={orphans.size}
            onReviewUpdates={() => setUpdatesOpen(true)}
            onReviewOrphans={() => setCleanupOpen(true)}
          />
        </>
      ) : (
        <div className="relative flex flex-1 flex-col">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 z-30 h-7"
            style={dragRegion("drag")}
          />
          <Onboarding
            // Invalidate everything: the mods query has already cached
            // an empty snapshot from before a folder existed.
            onPicked={() => void queryClient.invalidateQueries()}
          />
        </div>
      )}

      <ConfirmDialog
        pending={pending}
        busy={setEnabled.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          apply(pending.changes, pending.message);
          setPending(null);
        }}
      />
      <UpdateDialog
        open={updatesOpen}
        outdated={outdated}
        busy={updateMods.isPending}
        progress={progress}
        onClose={() => setUpdatesOpen(false)}
        onUpdate={runUpdate}
      />
      <OrphanDialog
        open={cleanupOpen}
        orphans={orphanFiles}
        busy={removeMods.isPending || setEnabled.isPending}
        onClose={() => setCleanupOpen(false)}
        onDisable={(fileNames) => cleanUp(fileNames, false)}
        onTrash={(fileNames) => cleanUp(fileNames, true)}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        folder={folder}
      />
      <StatusPill status={status} />
    </div>
  );
}

function ScanProgress() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="relative h-1 w-56 overflow-hidden rounded-full bg-muted/40">
        <div className="loader-shimmer absolute inset-y-0 h-full w-1/3 rounded-full bg-foreground/40" />
      </div>
      <p className="text-xs text-muted-foreground">reading mod manifests</p>
    </div>
  );
}

function Onboarding({ onPicked }: { onPicked: () => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    setBusy(true);
    try {
      const picked = await window.api.dialog.pickFolder();
      if (picked) {
        const config = await window.api.config.read();
        await window.api.config.write({ ...config, modsFolder: picked });
        onPicked();
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <button
        type="button"
        disabled={busy}
        onClick={() => void pick()}
        className="group flex h-64 w-full max-w-md cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center transition-all duration-150 outline-none hover:border-foreground/40 hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <FolderOpenIcon className="size-5 text-muted-foreground transition-colors group-hover:text-foreground" />
        <div className="text-sm font-medium">
          point Celery at your Mods folder
        </div>
        <p className="max-w-xs text-xs text-muted-foreground">
          the folder inside your Celeste install holding the mod zips,
          blacklist.txt and favorites.txt
        </p>
      </button>
    </div>
  );
}
