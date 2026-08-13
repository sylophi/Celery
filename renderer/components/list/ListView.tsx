import type { ModIndex } from "@shared/graph";
import type { ModFile } from "@shared/schemas";
import { StarIcon } from "lucide-react";
import { useSetFavorite } from "@/hooks/useMods";
import { ModIconGlyph } from "@/lib/modIcons";
import { cn, displayName } from "@/lib/utils";

// The launcher: every mod as a tile, top-level ones first and the
// infrastructure they pull in below. Where the graph view answers "how
// does this fit together", this one answers "what is in here" — so it
// stays a flat, scannable grid and leans on sorting rather than shape.

export type SortMode = "name" | "enabled" | "category" | "size" | "updated";

export const SORT_MODES: { value: SortMode; label: string }[] = [
  { value: "name", label: "name" },
  { value: "enabled", label: "enabled first" },
  { value: "category", label: "category" },
  { value: "size", label: "size" },
  { value: "updated", label: "recently updated" },
];

export function isSortMode(value: string | null): value is SortMode {
  return SORT_MODES.some((mode) => mode.value === value);
}

const byName = (a: ModFile, b: ModFile) =>
  displayName(a.fileName)
    .toLowerCase()
    .localeCompare(displayName(b.fileName).toLowerCase());

// Every mode breaks ties alphabetically.
function makeComparator(
  sort: SortMode,
  categoryOf: (fileName: string) => string | undefined,
): (a: ModFile, b: ModFile) => number {
  switch (sort) {
    case "name":
      return byName;
    case "enabled":
      return (a, b) => Number(b.enabled) - Number(a.enabled) || byName(a, b);
    case "category":
      // Unmapped mods sort last; tilde follows letters in ASCII.
      return (a, b) =>
        (categoryOf(a.fileName) ?? "~").localeCompare(
          categoryOf(b.fileName) ?? "~",
        ) || byName(a, b);
    case "size":
      return (a, b) => b.sizeBytes - a.sizeBytes || byName(a, b);
    case "updated":
      return (a, b) => b.mtimeMs - a.mtimeMs || byName(a, b);
  }
}

export function ListView({
  files,
  sort,
  orphans,
  updates,
  index,
  dependencySet,
  categoryOf,
  selectedId,
  onSelect,
}: {
  files: ModFile[];
  sort: SortMode;
  orphans: Set<string>;
  updates: Set<string>;
  index: ModIndex;
  dependencySet: Set<string>;
  categoryOf: (fileName: string) => string | undefined;
  selectedId: string | null;
  onSelect: (fileName: string | null) => void;
}) {
  const comparator = makeComparator(sort, categoryOf);
  const topLevel = files
    .filter((file) => !dependencySet.has(file.fileName))
    .toSorted(comparator);
  const depended = files
    .filter((file) => dependencySet.has(file.fileName))
    .toSorted(comparator);

  if (files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground/60">no mod matches</p>
      </div>
    );
  }

  const section = (label: string, list: ModFile[]) =>
    list.length === 0 ? null : (
      <section>
        <div className="mb-2 flex items-end justify-between px-1">
          <h2 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </h2>
          <span className="tabular text-[10px] text-muted-foreground/60">
            {list.length}
          </span>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-1 gap-y-2">
          {list.map((file) => (
            <ModTile
              key={file.fileName}
              file={file}
              selected={file.fileName === selectedId}
              orphan={orphans.has(file.fileName)}
              updateAvailable={updates.has(file.fileName)}
              missing={index.missing.get(file.fileName)?.length ?? 0}
              category={categoryOf(file.fileName)}
              onSelect={onSelect}
            />
          ))}
        </ul>
      </section>
    );

  // Escape clears the selection; the grid itself has no dead space
  // worth wiring up as a second way to do it.
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="flex flex-col gap-6 pb-8">
        {section("mods", topLevel)}
        {section("dependencies", depended)}
      </div>
    </div>
  );
}

function ModTile({
  file,
  selected,
  orphan,
  updateAvailable,
  missing,
  category,
  onSelect,
}: {
  file: ModFile;
  selected: boolean;
  orphan: boolean;
  updateAvailable: boolean;
  missing: number;
  category: string | undefined;
  onSelect: (fileName: string) => void;
}) {
  const setFavorite = useSetFavorite();
  const name = displayName(file.fileName);
  // One badge, worst news first: a broken mod outranks a wasteful one,
  // which outranks a merely out of date one.
  const badge =
    missing > 0 || file.parseError !== undefined
      ? {
          className: "bg-destructive",
          title: file.parseError ?? `${missing} missing dependencies`,
        }
      : orphan
        ? { className: "bg-warn", title: "nothing enabled needs this" }
        : updateAvailable
          ? { className: "bg-ring", title: "update available" }
          : null;

  return (
    // The badges are siblings of the tile button rather than children,
    // since a button inside a button is not valid. Columns are wider
    // than the icon, so they anchor to the icon's own edges (it is
    // centred, hence the calc) instead of drifting out to the corners.
    <li className="group relative">
      <button
        type="button"
        onClick={() => onSelect(file.fileName)}
        aria-label={`select ${name}`}
        aria-pressed={selected}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition-colors outline-none",
          "hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
          selected && "bg-accent",
        )}
      >
        <span
          className={cn(
            "grid size-13 place-items-center rounded-2xl ring-1 transition-colors",
            file.enabled
              ? "bg-card ring-border"
              : "bg-transparent ring-border/60",
            selected && "ring-2 ring-ring",
          )}
        >
          <ModIconGlyph
            category={category}
            tags={file.tags}
            className={cn(
              "size-6",
              file.enabled ? "text-foreground/80" : "text-muted-foreground/45",
            )}
            {...(category !== undefined ? { title: category } : {})}
          />
        </span>
        {/* Fixed two lines so rows stay level whatever the names do,
            and anywhere-wrapping because mod names are one long word. */}
        <span
          className={cn(
            "line-clamp-2 h-7 w-full text-center text-[11px] leading-tight wrap-anywhere",
            file.enabled ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {name}
        </span>
      </button>
      {badge && (
        <span
          aria-hidden
          title={badge.title}
          className={cn(
            "pointer-events-none absolute top-1.5 left-[calc(50%+18px)] size-2 rounded-full ring-2 ring-background",
            badge.className,
          )}
        />
      )}
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
          "absolute top-0.5 left-[calc(50%-32px)] cursor-pointer rounded p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
