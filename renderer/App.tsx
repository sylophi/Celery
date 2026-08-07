import { useEffect, useRef, useState } from "react";
import { FolderOpenIcon, RefreshCwIcon, Settings2Icon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { dependentClosure, findOrphans, planDisable, planEnable } from "@shared/graph";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ConfirmDialog, type PendingAction } from "@/components/ConfirmDialog";
import { DetailPanel } from "@/components/DetailPanel";
import { GraphView } from "@/components/graph/GraphView";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { StatusPill, type Status } from "@/components/StatusPill";
import { EMPTY_FOLDER_STATE } from "@shared/schemas";
import { useConfig, useFolderState, useModIndex, useMods, useSetEnabled } from "@/hooks/useMods";
import { queryKeys } from "@/lib/queryKeys";
import { cn, dragRegion } from "@/lib/utils";

export type GraphFilter = "all" | "enabled" | "orphans";

// Windows overlays native caption buttons over the top-right 28px of
// the client area; keep the toolbar's own controls clear of them.
const isWindows = window.api.platform === "win32";

export function App() {
  const queryClient = useQueryClient();
  const configQuery = useConfig();
  const modsQuery = useMods();
  const index = useModIndex(modsQuery.data);
  const folder = configQuery.data?.modsFolder;
  const folderStateQuery = useFolderState(folder);
  const folderState = folderStateQuery.data ?? EMPTY_FOLDER_STATE;
  const setEnabled = useSetEnabled();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<GraphFilter>("all");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Resizable sidebar, persisted across sessions.
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = Number(localStorage.getItem("celery.sidebarWidth"));
    return Number.isFinite(stored) && stored >= 180 && stored <= 420 ? stored : 240;
  });
  const startSidebarResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    let width = startWidth;
    const onMove = (move: MouseEvent) => {
      width = Math.min(420, Math.max(180, startWidth + move.clientX - startX));
      setSidebarWidth(width);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      localStorage.setItem("celery.sidebarWidth", String(width));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const orphans = index ? new Set(findOrphans(index)) : new Set<string>();

  // Which mods count as "dependencies" (vs top-level mods you play):
  // hard dependents only — a mod that is merely optionally referenced
  // stays top-level — with per-mod user overrides on top.
  const dependencySet = new Set<string>();
  for (const file of index?.files ?? []) {
    const byDefault = (index?.dependents.get(file.fileName)?.size ?? 0) > 0;
    const section =
      folderState.sectionOverrides[file.fileName] ?? (byDefault ? "dependency" : "mod");
    if (section === "dependency") dependencySet.add(file.fileName);
  }

  // `/` focuses search, Escape clears the selection. Skipped while
  // typing or while a dialog ([data-popup]) is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [data-popup]")) return;
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

  const apply = (changes: { fileName: string; enabled: boolean }[], message: string) => {
    setEnabled.mutate(changes, {
      onSuccess: () => setStatus((prev) => ({ text: message, nonce: (prev?.nonce ?? 0) + 1 })),
    });
  };

  // Dependency-aware toggling. Enabling pulls in the disabled part of
  // the hard-dep closure. Disabling a single mod takes its enabled
  // dependents down too; disabling a group keeps members an enabled
  // outsider still needs. Cascades apply immediately by default — the
  // status pill reports what happened — unless the confirm-cascades
  // setting routes them through the preview dialog first.
  const requestToggle = (fileNames: string[], enable: boolean, label: string) => {
    if (!index) return;
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
      const plan = planEnable(index, fileNames);
      const changes = [...plan.targets, ...plan.cascade].map((fileName) => ({
        fileName,
        enabled: true,
      }));
      const message =
        plan.cascade.length > 0
          ? `enabled ${label} + ${plan.cascade.length} dependencies`
          : `enabled ${label}`;
      run(changes, message, {
        title: "enable dependencies too?",
        sections: [{ label: "needs these disabled mods", items: plan.cascade }],
        confirmLabel: `enable ${changes.length} mods`,
      });
      return;
    }

    const plan = planDisable(index, fileNames);
    if (plan.targets.length === 0 && plan.kept.length > 0) {
      // Everything requested is still needed by enabled outsiders: a
      // single-mod disable takes those dependents down with it.
      const forced = [...dependentClosure(index, plan.kept)]
        .filter((f) => index.byFileName.get(f)?.enabled)
        .toSorted();
      const dependents = forced.filter((f) => !fileNames.includes(f));
      run(
        forced.map((fileName) => ({ fileName, enabled: false })),
        `disabled ${label} + ${dependents.length} dependents`,
        {
          title: "disable dependents too?",
          sections: [{ label: "these enabled mods need it", items: dependents }],
          confirmLabel: `disable ${forced.length} mods`,
        },
      );
      return;
    }
    const message =
      plan.kept.length > 0
        ? `disabled ${label} · kept ${plan.kept.length} shared`
        : `disabled ${label}`;
    run(
      plan.targets.map((fileName) => ({ fileName, enabled: false })),
      message,
      {
        title: "some mods stay on",
        sections: [
          {
            label: "kept on — still needed by enabled mods outside the group",
            items: plan.kept,
          },
        ],
        confirmLabel: `disable ${plan.targets.length} mods`,
      },
    );
  };

  const selectedFile = selectedId && index ? (index.byFileName.get(selectedId) ?? null) : null;
  const enabledCount = modsQuery.data?.files.filter((f) => f.enabled).length ?? 0;
  const totalCount = modsQuery.data?.files.length ?? 0;

  return (
    <div className="flex h-dvh overflow-hidden text-foreground">
      <div style={{ width: sidebarWidth }} className="shrink-0">
        <Sidebar
          files={modsQuery.data?.files ?? []}
          folderState={folderState}
          folder={folder}
          index={index}
          orphans={orphans}
          dependencySet={dependencySet}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onToggleGroup={(group, enable) => requestToggle(group.members, enable, group.name)}
          searchRef={searchRef}
        />
      </div>
      <div
        onMouseDown={startSidebarResize}
        className="relative w-px shrink-0 cursor-col-resize bg-border"
      >
        <div className="absolute inset-y-0 -left-1 z-10 w-2" />
      </div>
      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {folder ? (
          <>
            <header
              className={cn(
                "z-40 flex h-12 shrink-0 items-center gap-3 border-b border-border px-4",
                isWindows && "pr-[150px]",
              )}
              style={dragRegion("drag")}
            >
              <div style={dragRegion("no-drag")}>
                <SegmentedControl<GraphFilter>
                  options={[
                    { value: "all", label: "all", selected: filter === "all" },
                    {
                      value: "enabled",
                      label: "enabled",
                      selected: filter === "enabled",
                    },
                    {
                      value: "orphans",
                      label: `orphans${orphans.size > 0 ? ` ${orphans.size}` : ""}`,
                      selected: filter === "orphans",
                    },
                  ]}
                  onSelect={setFilter}
                />
              </div>
              <span className="tabular text-xs text-muted-foreground/70">
                {totalCount} mods · {enabledCount} enabled
              </span>
              <div className="flex-1" />
              <div className="flex items-center gap-1" style={dragRegion("no-drag")}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="rescan mods folder"
                  title="rescan mods folder"
                  disabled={modsQuery.isFetching}
                  onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.mods })}
                >
                  <RefreshCwIcon className={modsQuery.isFetching ? "animate-spin" : undefined} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="settings"
                  title="settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings2Icon />
                </Button>
              </div>
            </header>
            <div className="relative min-h-0 flex-1">
              {modsQuery.isLoading ? (
                <ScanProgress />
              ) : (
                index && (
                  <GraphView
                    index={index}
                    filter={filter}
                    orphans={orphans}
                    dependencySet={dependencySet}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                )
              )}
              {selectedFile && index && (
                <DetailPanel
                  file={selectedFile}
                  index={index}
                  orphan={orphans.has(selectedFile.fileName)}
                  folderState={folderState}
                  dependencySet={dependencySet}
                  folder={folder}
                  onSelect={setSelectedId}
                  onClose={() => setSelectedId(null)}
                  onToggle={(enable) =>
                    requestToggle(
                      [selectedFile.fileName],
                      enable,
                      displayName(selectedFile.fileName),
                    )
                  }
                />
              )}
            </div>
          </>
        ) : (
          <>
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 z-30 h-7"
              style={dragRegion("drag")}
            />
            <Onboarding
              onPicked={() => void queryClient.invalidateQueries({ queryKey: queryKeys.config })}
            />
          </>
        )}
      </main>

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
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} folder={folder} />
      <StatusPill status={status} />
    </div>
  );
}

export function displayName(fileName: string): string {
  return fileName.replace(/\.zip$/i, "");
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
        <div className="text-sm font-medium">point Celery at your Mods folder</div>
        <p className="max-w-xs text-xs text-muted-foreground">
          the folder inside your Celeste install holding the mod zips, blacklist.txt and
          favorites.txt
        </p>
      </button>
    </div>
  );
}
