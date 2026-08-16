import { useEffect, useRef, useState } from "react";
import { FolderOpenIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  dependentClosure,
  findOrphans,
  findUnused,
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
import { UnusedDialog } from "@/components/UnusedReview";
import { UpdateDialog, type Outdated } from "@/components/UpdateReview";
import { GridView } from "@/components/browse/GridView";
import { ListView } from "@/components/browse/ListView";
import { isSortMode, type SortMode } from "@/components/browse/sort";
import { SettingsDialog } from "@/components/SettingsDialog";
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
import type { IdleState } from "@/lib/findings";
import { queryKeys } from "@/lib/queryKeys";
import { notifyError, toast } from "@/lib/toast";
import { displayName, dragRegion, plural } from "@/lib/utils";

const VIEW_STORAGE_KEY = "celery.view";
const SORT_STORAGE_KEY = "celery.sortMode";

export function App() {
  const queryClient = useQueryClient();
  const configQuery = useConfig();
  const folder = configQuery.data?.modsFolder;
  const modsQuery = useMods(folder);
  const index = useModIndex(modsQuery.data);
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
  const [orphansOpen, setOrphansOpen] = useState(false);
  const [unusedOpen, setUnusedOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const changeView = (next: View) => {
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  };
  const changeSort = (next: SortMode) => {
    setSort(next);
    localStorage.setItem(SORT_STORAGE_KEY, next);
  };

  // Two separate problems, found separately. The views only ever draw
  // one badge per mod, so they get the two folded into a single lookup.
  // The reviews get their own list, since each does its own thing.
  const orphanFiles = index ? findOrphans(index) : [];
  const unusedRows = index ? findUnused(index) : [];
  const idle = new Map<string, IdleState>();
  for (const file of orphanFiles) idle.set(file.fileName, { kind: "orphan" });
  for (const row of unusedRows) {
    idle.set(row.file.fileName, { kind: "unused", wantedBy: row.wantedBy });
  }
  // How each zip maps onto GameBanana: its category, whether a newer
  // build exists, and the mod Name the artwork is fetched under.
  const remoteOf = (fileName: string) => overview.data?.byFile[fileName];

  // Derived once and shared: the status bar's count and the review's
  // rows have to be the same mods. Walking the installed files rather
  // than the database's keys also drops any entry with no zip behind it.
  const outdated: Outdated[] = (index?.files ?? []).flatMap((file) => {
    const remote = remoteOf(file.fileName);
    return remote?.updateAvailable === true ? [{ file, remote }] : [];
  });
  const updates = new Set(outdated.map((row) => row.file.fileName));

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
      onSuccess: () => toast.success(message),
      // A failed write (locked blacklist.txt, permissions) must be
      // visible, not a toggle that silently snaps back.
      onError: (error) => notifyError("couldn't write blacklist", error),
    });
  };

  // Dependency-aware toggling. Enabling pulls in the disabled part of
  // the hard-dep closure; disabling takes down everything enabled that
  // would break without it. Cascades apply immediately by default (a
  // toast reports what happened) unless the confirm-cascades
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
    idle,
    updates,
    dependencySet,
    remoteOf,
    selectedId,
    onSelect: setSelectedId,
  };

  const runUpdate = (fileNames: string[]) => {
    updateMods.mutate(fileNames, {
      onSuccess: (result) => {
        // Only close once everything worked: a failed row has to stay
        // on screen with its reason attached.
        if (result.failed.length === 0) {
          setUpdatesOpen(false);
          toast.success(`updated ${plural(result.updated.length, "mod")}`);
          return;
        }
        // Through notifyError, not toast.error: a batch where every
        // row failed the same way should say so once.
        notifyError(
          `updated ${result.updated.length}, ${result.failed.length} failed`,
          result.failed[0]?.error,
        );
      },
      onError: (error) => notifyError("couldn't update", error),
    });
  };

  // The unused review's one action. Straight through `apply`, since
  // this is the same write as toggling a mod off by hand.
  const disableUnused = (fileNames: string[]) => {
    setUnusedOpen(false);
    apply(
      fileNames.map((fileName) => ({ fileName, enabled: false })),
      `disabled ${plural(fileNames.length, "unused mod")}`,
    );
  };

  // Trashing is reported rather than announced: a partial failure has to
  // be visible, not swallowed.
  const trashOrphans = (fileNames: string[]) => {
    setOrphansOpen(false);
    const label = plural(fileNames.length, "orphan");
    removeMods.mutate(fileNames, {
      onSuccess: (result) => {
        if (result.failed.length === 0) {
          toast.success(`moved ${label} to the trash`);
          return;
        }
        notifyError(
          `trashed ${result.trashed.length}, couldn't remove ${result.failed.length}`,
          result.failed[0]?.error,
        );
      },
      onError: (error) => notifyError("couldn't remove", error),
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
          idle={idle.get(selectedFile.fileName)}
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
    // No background of its own: the atmosphere behind the app is what
    // fills the gaps between its surfaces.
    <div className="flex h-dvh flex-col overflow-hidden text-foreground">
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
              void queryClient.invalidateQueries({
                queryKey: queryKeys.modsAll,
              });
              void queryClient.invalidateQueries({
                queryKey: queryKeys.remoteOverview,
              });
            }}
            onSettings={() => setSettingsOpen(true)}
          />
          <main className="relative flex min-h-0 flex-1">
            <div className="relative min-w-0 flex-1">
              {modsQuery.isError ? (
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
                        queryKey: queryKeys.modsAll,
                      })
                    }
                  >
                    try again
                  </Button>
                </div>
              ) : !index ? (
                // No index means no snapshot for THIS folder yet: the
                // first scan after onboarding, or one after a switch.
                <ScanProgress />
              ) : view === "graph" ? (
                <GraphView
                  index={index}
                  scope={new Set(scope.map((f) => f.fileName))}
                  visible={new Set(visible.map((f) => f.fileName))}
                  idle={idle}
                  dependencySet={dependencySet}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : view === "grid" ? (
                <GridView {...browseProps} index={index} />
              ) : (
                <ListView {...browseProps} index={index} />
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
            total={scope.length}
            enabled={scope.filter((f) => f.enabled).length}
            updates={updates.size}
            unused={unusedRows.length}
            orphans={orphanFiles.length}
            onReviewUpdates={() => setUpdatesOpen(true)}
            onReviewUnused={() => setUnusedOpen(true)}
            onReviewOrphans={() => setOrphansOpen(true)}
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
            // Only the config: reading the folder back is what enables
            // the scan, and every other query is either keyed by that
            // folder or waiting on it, so each starts empty by itself.
            onPicked={() =>
              void queryClient.invalidateQueries({ queryKey: queryKeys.config })
            }
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
      <UnusedDialog
        open={unusedOpen}
        unused={unusedRows}
        busy={setEnabled.isPending}
        onClose={() => setUnusedOpen(false)}
        onDisable={disableUnused}
      />
      <OrphanDialog
        open={orphansOpen}
        orphans={orphanFiles}
        busy={removeMods.isPending}
        onClose={() => setOrphansOpen(false)}
        onTrash={trashOrphans}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        folder={folder}
      />
    </div>
  );
}

function ScanProgress() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="relative h-1 w-56 overflow-hidden rounded-full bg-muted/40">
        <div className="loader-shimmer absolute inset-y-0 left-0 h-full w-1/3 rounded-full gradient-accent" />
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
        className="group flex h-64 w-full max-w-md cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-popover/70 text-center transition-[transform,border-color,box-shadow] duration-150 outline-none hover:-translate-y-0.5 hover:border-ring/60 hover:shadow-floating focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <FolderOpenIcon className="size-5 text-muted-foreground transition-colors group-hover:text-ring" />
        <div className="gradient-accent-text text-sm font-medium">
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
