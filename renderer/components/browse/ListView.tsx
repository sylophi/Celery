import { StarIcon } from "lucide-react";
import type { ModIndex } from "@shared/graph";
import type { ModFile, RemoteFileStatus } from "@shared/schemas";
import { useSetFavorite } from "@/hooks/useMods";
import { ModIconGlyph } from "@/lib/modIcons";
import { cn, displayName, formatBytes } from "@/lib/utils";
import { BrowseHeader } from "./BrowseHeader";
import { BrowseSection } from "./Section";
import { makeComparator, type SortMode } from "./sort";

// The dense one. Where the grid trades detail for recognisability, the
// list spends the same room on the columns you would otherwise have to
// open each mod to compare: version, category, size, what needs it.

export function ListView({
  files,
  total,
  query,
  sort,
  onSort,
  orphans,
  updates,
  index,
  dependencySet,
  remoteOf,
  selectedId,
  onSelect,
}: {
  files: ModFile[];
  total: number;
  query: string;
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  orphans: Set<string>;
  updates: Set<string>;
  index: ModIndex;
  dependencySet: Set<string>;
  remoteOf: (fileName: string) => RemoteFileStatus | undefined;
  selectedId: string | null;
  onSelect: (fileName: string | null) => void;
}) {
  const comparator = makeComparator(sort, (f) => remoteOf(f)?.category);
  const section = (label: "mods" | "dependencies", list: ModFile[]) => (
    <BrowseSection label={label} count={list.length}>
      <ul>
        {list.map((file) => (
          <ModRow
            key={file.fileName}
            file={file}
            remote={remoteOf(file.fileName)}
            selected={file.fileName === selectedId}
            orphan={orphans.has(file.fileName)}
            updateAvailable={updates.has(file.fileName)}
            missing={index.missing.get(file.fileName)?.length ?? 0}
            neededBy={index.dependents.get(file.fileName)?.size ?? 0}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </BrowseSection>
  );

  return (
    <div className="@container flex h-full flex-col">
      <BrowseHeader
        shown={files.length}
        total={total}
        query={query}
        sort={sort}
        onSort={onSort}
      />
      {/* No top padding on the scroll box itself: `sticky top-0`
          resolves against its padding edge, so any would leave a
          band above the section headers for rows to show through. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {files.length === 0 ? (
          <p className="py-16 text-center text-xs text-muted-foreground/60">
            no mod matches
          </p>
        ) : (
          <div className="flex flex-col gap-6 pt-3">
            {section(
              "mods",
              files
                .filter((f) => !dependencySet.has(f.fileName))
                .toSorted(comparator),
            )}
            {section(
              "dependencies",
              files
                .filter((f) => dependencySet.has(f.fileName))
                .toSorted(comparator),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModRow({
  file,
  remote,
  selected,
  orphan,
  updateAvailable,
  missing,
  neededBy,
  onSelect,
}: {
  file: ModFile;
  remote: RemoteFileStatus | undefined;
  selected: boolean;
  orphan: boolean;
  updateAvailable: boolean;
  missing: number;
  neededBy: number;
  onSelect: (fileName: string) => void;
}) {
  const setFavorite = useSetFavorite();
  const name = displayName(file.fileName);
  const version = file.entries[0]?.version ?? "";

  return (
    <li
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-md px-2 transition-colors",
        selected ? "bg-accent" : "hover:bg-accent",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(file.fileName)}
        aria-label={`select ${name}`}
        aria-pressed={selected}
        className="absolute inset-0 cursor-pointer rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <span
        aria-hidden
        title={file.enabled ? "enabled" : "disabled"}
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          file.enabled ? "bg-on" : "bg-muted-foreground/30",
        )}
      />
      <ModIconGlyph
        category={remote?.category}
        tags={file.tags}
        className="size-3.5 shrink-0 text-muted-foreground/70"
        {...(remote?.category !== undefined ? { title: remote.category } : {})}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          file.enabled ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {name}
      </span>

      {missing > 0 && (
        <span
          className="shrink-0 text-[10px] text-destructive"
          title={`${missing} dependencies are not installed`}
        >
          {missing} missing
        </span>
      )}
      {file.parseError !== undefined && (
        <span
          className="shrink-0 text-[10px] text-destructive"
          title={file.parseError}
        >
          no manifest
        </span>
      )}
      {orphan && (
        <span
          className="shrink-0 text-[10px] text-warn"
          title="nothing enabled needs this"
        >
          orphan
        </span>
      )}
      {updateAvailable && (
        <span
          className="shrink-0 text-[10px] text-muted-foreground"
          title={`GameBanana has ${remote?.latestVersion ?? "a newer build"}`}
        >
          update
        </span>
      )}

      {/* Columns hold their width so the eye can run down them, and drop
          out entirely before the name starts truncating. */}
      <span className="hidden w-28 shrink-0 truncate text-right text-[11px] text-muted-foreground/70 @3xl:block">
        {remote?.category ?? ""}
      </span>
      {/* Counts every installed dependent, enabled or not — which is why
          an orphan can still show one. Orphan means nothing ENABLED
          needs it, so the tooltip has to say which count this is. */}
      <span
        className="tabular hidden w-24 shrink-0 truncate text-right text-[11px] text-muted-foreground/70 @2xl:block"
        {...(neededBy > 0
          ? {
              title: `${neededBy} installed mods depend on this, enabled or not`,
            }
          : {})}
      >
        {neededBy > 0 ? `${neededBy} need it` : ""}
      </span>
      <span className="tabular hidden w-14 shrink-0 truncate text-right text-[11px] text-muted-foreground/60 @xl:block">
        {version}
      </span>
      <span className="tabular w-16 shrink-0 text-right text-[11px] text-muted-foreground/60">
        {formatBytes(file.sizeBytes)}
      </span>

      <button
        type="button"
        aria-label={file.favorite ? `unfavorite ${name}` : `favorite ${name}`}
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
