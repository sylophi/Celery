import type { RefObject } from "react";
import {
  LayoutGridIcon,
  NetworkIcon,
  RefreshCwIcon,
  Settings2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, dragRegion } from "@/lib/utils";

// The app's one chrome bar: which view you are in, what it is showing,
// and the two global actions. It also stands in for the title bar, so
// it carries the drag region and keeps clear of the native window
// buttons — macOS traffic lights on the left by a fixed inset, Windows
// caption buttons on the right via `[data-titlebar]` in the stylesheet,
// which reads their real width out of the Window Controls Overlay.

export type View = "graph" | "list";
export type Filter = "all" | "enabled" | "orphans";

const isMac = window.api.platform === "darwin";

export function Toolbar({
  view,
  onView,
  filter,
  onFilter,
  orphanCount,
  search,
  onSearch,
  searchRef,
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
  rescanning: boolean;
  onRescan: () => void;
  onSettings: () => void;
}) {
  return (
    <header
      data-titlebar
      className={cn(
        "z-40 flex h-11 shrink-0 items-center gap-2.5 border-b border-border px-3",
        isMac && "pl-[92px]",
      )}
      style={dragRegion("drag")}
    >
      <span className="shrink-0 pr-0.5 text-[13px] font-semibold tracking-tight">
        Celery
      </span>
      <div
        className="flex shrink-0 items-center gap-2"
        style={dragRegion("no-drag")}
      >
        <SegmentedControl<View>
          size="md"
          options={[
            {
              value: "graph",
              label: "graph",
              selected: view === "graph",
              icon: <NetworkIcon aria-hidden className="size-3.5" />,
            },
            {
              value: "list",
              label: "list",
              selected: view === "list",
              icon: <LayoutGridIcon aria-hidden className="size-3.5" />,
            },
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
      {/* Everything right of here shrinks before anything wraps: the
          window's 800px minimum has to hold the whole bar, caption
          buttons included. */}
      <div
        className="flex min-w-0 flex-1 items-center justify-end gap-2"
        style={dragRegion("no-drag")}
      >
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
          className="h-7 w-full max-w-48 min-w-24 rounded-md border border-input bg-transparent px-2 text-xs text-foreground transition-colors outline-none placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
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
