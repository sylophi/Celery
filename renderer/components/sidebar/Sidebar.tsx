import { useEffect, useRef, useState, type RefObject } from "react";
import { PlusIcon, StarIcon } from "lucide-react";
import type { FolderState, Group, ModFile } from "@shared/schemas";
import type { ModIndex } from "@shared/graph";
import { displayName } from "@/App";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSaveFolderState, useSetFavorite } from "@/hooks/useMods";
import { useRemoteOverview } from "@/hooks/useRemote";
import { cn, dragRegion } from "@/lib/utils";

const isMac = window.api.platform === "darwin";

export function Sidebar({
  files,
  folderState,
  folder,
  index,
  orphans,
  dependencySet,
  selectedId,
  onSelect,
  onToggleGroup,
  searchRef,
}: {
  files: ModFile[];
  folderState: FolderState;
  folder: string | undefined;
  index: ModIndex | null;
  orphans: Set<string>;
  dependencySet: Set<string>;
  selectedId: string | null;
  onSelect: (fileName: string | null) => void;
  onToggleGroup: (group: Group, enable: boolean) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const overview = useRemoteOverview(Boolean(folder));
  const updates = new Set(
    Object.entries(overview.data?.byFile ?? {})
      .filter(([, status]) => status.updateAvailable)
      .map(([fileName]) => fileName),
  );
  const matches = query
    ? files.filter(
        (file) =>
          file.fileName.toLowerCase().includes(query) ||
          file.entries.some((entry) =>
            entry.name.toLowerCase().includes(query),
          ),
      )
    : files;
  // Top-level mods (the things you actually play) get their own
  // section; dependencies sit below it, de-emphasized. Classification
  // comes from App: hard dependents + per-mod overrides.
  const topLevel = matches.filter((file) => !dependencySet.has(file.fileName));
  const depended = matches.filter((file) => dependencySet.has(file.fileName));

  return (
    <aside data-sidebar className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-[52px] shrink-0 items-center gap-2 px-3",
          isMac && "pl-[92px]",
        )}
        style={dragRegion("drag")}
      >
        <div className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">
          Celery
        </div>
      </div>

      {folder && (
        <div className="shrink-0 px-2 pb-1" style={dragRegion("no-drag")}>
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearch("");
                event.currentTarget.blur();
              }
            }}
            placeholder="search mods"
            spellCheck={false}
            className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs text-foreground transition-colors outline-none placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {folder && !query && (
          <GroupsSection
            folderState={folderState}
            folder={folder}
            index={index}
            onToggleGroup={onToggleGroup}
          />
        )}

        {folder && (
          <div className="px-2">
            <ModSection
              label="mods"
              files={topLevel}
              hasDependents={false}
              selectedId={selectedId}
              orphans={orphans}
              updates={updates}
              onSelect={onSelect}
            />
            <ModSection
              label="dependencies"
              files={depended}
              hasDependents
              selectedId={selectedId}
              orphans={orphans}
              updates={updates}
              onSelect={onSelect}
            />
            {topLevel.length === 0 && depended.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground/60">
                no mod matches “{search.trim()}”
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground/60">
          {folder ? folder : "no folder yet"}
        </span>
        {updates.size > 0 && (
          <span
            className="tabular shrink-0 text-[10px] text-muted-foreground"
            title="newer builds exist on GameBanana"
          >
            {updates.size} updates
          </span>
        )}
        {orphans.size > 0 && (
          <span
            className="tabular shrink-0 text-[10px] text-warn"
            title="support mods nothing depends on"
          >
            {orphans.size} orphans
          </span>
        )}
      </div>
    </aside>
  );
}

function ModSection({
  label,
  files,
  hasDependents,
  selectedId,
  orphans,
  updates,
  onSelect,
}: {
  label: string;
  files: ModFile[];
  hasDependents: boolean;
  selectedId: string | null;
  orphans: Set<string>;
  updates: Set<string>;
  onSelect: (fileName: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <>
      <div className="flex h-7 items-end justify-between px-1 pb-1">
        <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </h3>
        <span className="tabular text-[10px] text-muted-foreground/60">
          {files.length}
        </span>
      </div>
      <ul className="pb-1">
        {files.map((file) => (
          <ModRow
            key={file.fileName}
            file={file}
            hasDependents={hasDependents}
            selected={file.fileName === selectedId}
            orphan={orphans.has(file.fileName)}
            updateAvailable={updates.has(file.fileName)}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </>
  );
}

function ModRow({
  file,
  hasDependents,
  selected,
  orphan,
  updateAvailable,
  onSelect,
}: {
  file: ModFile;
  hasDependents: boolean;
  selected: boolean;
  orphan: boolean;
  updateAvailable: boolean;
  onSelect: (fileName: string) => void;
}) {
  const setFavorite = useSetFavorite();
  return (
    <li
      className={cn(
        "group relative flex h-8 items-center gap-2 rounded-lg px-2 transition-colors",
        selected ? "bg-accent" : "hover:bg-accent",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(file.fileName)}
        aria-label={`select ${displayName(file.fileName)}`}
        className="absolute inset-0 cursor-pointer rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          file.enabled ? "bg-on" : "bg-muted-foreground/30",
        )}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          hasDependents ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {displayName(file.fileName)}
      </span>
      {updateAvailable && (
        <span
          aria-hidden
          title="update available"
          className="relative size-1 shrink-0 rounded-full bg-ring"
        />
      )}
      {orphan && (
        <span
          aria-hidden
          title="nothing depends on this"
          className="relative size-1 shrink-0 rounded-full bg-warn"
        />
      )}
      <button
        type="button"
        aria-label={file.favorite ? "unfavorite" : "favorite"}
        aria-pressed={file.favorite}
        onClick={() =>
          setFavorite.mutate({
            fileName: file.fileName,
            favorite: !file.favorite,
          })
        }
        className={cn(
          "relative shrink-0 cursor-pointer rounded p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          file.favorite
            ? "text-foreground"
            : "text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100",
        )}
      >
        <StarIcon className={cn("size-3", file.favorite && "fill-current")} />
      </button>
    </li>
  );
}

function GroupsSection({
  folderState,
  folder,
  index,
  onToggleGroup,
}: {
  folderState: FolderState;
  folder: string;
  index: ModIndex | null;
  onToggleGroup: (group: Group, enable: boolean) => void;
}) {
  const saveState = useSaveFolderState(folder);
  const groups = folderState.groups;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const create = () => {
    const trimmed = name.trim();
    if (trimmed) {
      saveState.mutate((state) => ({
        ...state,
        groups: [
          ...state.groups,
          { id: crypto.randomUUID(), name: trimmed, members: [] },
        ],
      }));
    }
    setName("");
    setAdding(false);
  };

  return (
    <div className="px-2 pb-2" style={dragRegion("no-drag")}>
      <div className="flex h-7 items-end justify-between px-1 pb-1">
        <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          groups
        </h3>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="new group"
          title="new group"
          className="text-muted-foreground"
          onClick={() => setAdding(true)}
        >
          <PlusIcon />
        </Button>
      </div>
      {groups.map((group) => (
        <GroupRow
          key={group.id}
          group={group}
          groups={groups}
          index={index}
          onToggle={onToggleGroup}
          onDelete={() =>
            saveState.mutate((state) => ({
              ...state,
              groups: state.groups.filter((g) => g.id !== group.id),
            }))
          }
        />
      ))}
      {adding ? (
        <input
          // The input only mounts after an explicit "new group" click,
          // so moving focus into it is the expected outcome.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={create}
          onKeyDown={(event) => {
            if (event.key === "Enter") create();
            if (event.key === "Escape") {
              setName("");
              setAdding(false);
            }
          }}
          placeholder="group name"
          spellCheck={false}
          className="mt-0.5 h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring"
        />
      ) : (
        groups.length === 0 && (
          <p className="px-1 py-1 text-xs leading-snug text-muted-foreground/60">
            group mods by activity, then flip them on and off together
          </p>
        )
      )}
    </div>
  );
}

function GroupRow({
  group,
  index,
  onToggle,
  onDelete,
}: {
  group: Group;
  groups: Group[];
  index: ModIndex | null;
  onToggle: (group: Group, enable: boolean) => void;
  onDelete: () => void;
}) {
  const members = group.members.filter((m) => index?.byFileName.has(m));
  const enabledCount = members.filter(
    (m) => index?.byFileName.get(m)?.enabled,
  ).length;
  const allOn = members.length > 0 && enabledCount === members.length;

  // Two-step destructive action instead of a confirm dialog: first
  // click arms for 4s, second click deletes.
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="group/grouprow flex h-8 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-accent">
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
        {group.name}
      </span>
      <button
        type="button"
        aria-label={`delete group ${group.name}`}
        onClick={() => {
          if (armed) {
            onDelete();
            return;
          }
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 4000);
        }}
        className={cn(
          "shrink-0 cursor-pointer rounded px-1 text-[10px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          armed
            ? "text-destructive"
            : "text-muted-foreground/60 opacity-0 group-hover/grouprow:opacity-100 hover:text-foreground focus-visible:opacity-100",
        )}
      >
        {armed ? "sure?" : "delete"}
      </button>
      <span className="tabular shrink-0 text-[10px] text-muted-foreground/60">
        {enabledCount}/{members.length}
      </span>
      <Switch
        checked={allOn}
        disabled={members.length === 0}
        label={`toggle group ${group.name}`}
        onChange={(next) => onToggle(group, next)}
      />
    </div>
  );
}
