import type { RefObject } from "react";
import { ArrowUpDownIcon, RefreshCwIcon, Settings2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SORT_MODES, type SortMode } from "@/components/list/ListView";
import { cn, dragRegion } from "@/lib/utils";

// The app's one chrome bar: which view you are in, what it is showing,
// and the two global actions. It also stands in for the title bar, so
// it carries the drag region and the room the native window buttons
// need on either platform.

export type View = "graph" | "list";
export type Filter = "all" | "enabled" | "orphans";

const isMac = window.api.platform === "darwin";
// Windows overlays native caption buttons over the top-right of the
// client area; keep the toolbar's own controls clear of them.
const isWindows = window.api.platform === "win32";

export function Toolbar({
  view,
  onView,
  filter,
  onFilter,
  orphanCount,
  search,
  onSearch,
  searchRef,
  sort,
  onSort,
  rescanning,
  onRescan,
  onSettings,
}: {
  view: View;
  onView: (view: View) => void;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  orphanCount: number;
  search: string;
  onSearch: (search: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  rescanning: boolean;
  onRescan: () => void;
  onSettings: () => void;
}) {
  return (
    <header
      className={cn(
        "z-40 flex h-13 shrink-0 items-center gap-3 border-b border-border px-4",
        isMac && "pl-[92px]",
        isWindows && "pr-[150px]",
      )}
      style={dragRegion("drag")}
    >
      <span className="shrink-0 text-[13px] font-semibold tracking-tight">
        Celery
      </span>
      <div className="flex items-center gap-2" style={dragRegion("no-drag")}>
        <SegmentedControl<View>
          options={[
            { value: "graph", label: "graph", selected: view === "graph" },
            { value: "list", label: "list", selected: view === "list" },
          ]}
          onSelect={onView}
        />
        <SegmentedControl<Filter>
          options={[
            { value: "all", label: "all", selected: filter === "all" },
            {
              value: "enabled",
              label: "enabled",
              selected: filter === "enabled",
            },
            {
              value: "orphans",
              label: `orphans${orphanCount > 0 ? ` ${orphanCount}` : ""}`,
              selected: filter === "orphans",
            },
          ]}
          onSelect={onFilter}
        />
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2" style={dragRegion("no-drag")}>
        {view === "list" && (
          <label className="flex items-center gap-1.5">
            <ArrowUpDownIcon
              aria-hidden
              className="size-3 shrink-0 text-muted-foreground/60"
            />
            <select
              value={sort}
              onChange={(event) => onSort(event.target.value as SortMode)}
              aria-label="sort mods by"
              className="h-7 cursor-pointer appearance-none rounded-md bg-transparent pr-1 text-[11px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
            >
              {SORT_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <input
          ref={searchRef}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onSearch("");
              event.currentTarget.blur();
            }
          }}
          placeholder="search mods"
          spellCheck={false}
          className="h-7 w-44 rounded-md border border-input bg-transparent px-2 text-xs text-foreground transition-colors outline-none placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="rescan mods folder"
          title="rescan mods folder"
          disabled={rescanning}
          onClick={onRescan}
        >
          <RefreshCwIcon className={rescanning ? "animate-spin" : undefined} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="settings"
          title="settings"
          onClick={onSettings}
        >
          <Settings2Icon />
        </Button>
      </div>
    </header>
  );
}

export function StatusBar({
  folder,
  total,
  enabled,
  updates,
  orphans,
}: {
  folder: string;
  total: number;
  enabled: number;
  updates: number;
  orphans: number;
}) {
  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border px-4">
      <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground/60">
        {folder}
      </span>
      <span className="tabular shrink-0 text-[10px] text-muted-foreground/70">
        {total} mods, {enabled} enabled
      </span>
      {updates > 0 && (
        <span
          className="tabular shrink-0 text-[10px] text-muted-foreground"
          title="newer builds exist on GameBanana"
        >
          {updates} updates
        </span>
      )}
      {orphans > 0 && (
        <span
          className="tabular shrink-0 text-[10px] text-warn"
          title="support mods nothing enabled depends on"
        >
          {orphans} orphans
        </span>
      )}
    </footer>
  );
}
