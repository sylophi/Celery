import { ArrowUpDownIcon } from "lucide-react";
import type { ModFile } from "@shared/schemas";
import { displayName } from "@/lib/utils";

// Ordering shared by the two browse views. It belongs to them rather
// than to the toolbar: the graph has no use for it, and a control that
// comes and goes with the view makes the chrome feel unstable.

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
export function makeComparator(
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

export function SortSelect({
  sort,
  onSort,
}: {
  sort: SortMode;
  onSort: (sort: SortMode) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <ArrowUpDownIcon
        aria-hidden
        className="size-3 shrink-0 text-muted-foreground/60"
      />
      <select
        value={sort}
        onChange={(event) => onSort(event.target.value as SortMode)}
        aria-label="sort mods by"
        className="h-6 cursor-pointer appearance-none rounded-md bg-transparent pr-1 text-[11px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
      >
        {SORT_MODES.map((mode) => (
          <option key={mode.value} value={mode.value}>
            {mode.label}
          </option>
        ))}
      </select>
    </label>
  );
}
