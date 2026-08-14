import type { RefObject } from "react";
import {
  ChevronRightIcon,
  LayoutGridIcon,
  ListIcon,
  NetworkIcon,
  RefreshCwIcon,
  Settings2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, dragRegion } from "@/lib/utils";

// The app's chrome: which view you are in and the two global actions on
// top, what is being counted along the bottom. The top bar stands in for
// the native title bar, so it carries `data-titlebar` and the stylesheet
// keeps it clear of the window buttons — nothing here has to know which
// platform it is running on. The status bar only borrows the same
// padding, since nothing is overlaid down there.

export type View = "grid" | "list" | "graph";

export function Toolbar({
  view,
  onView,
  search,
  onSearch,
  searchRef,
  rescanning,
  onRescan,
  onSettings,
}: {
  view: View;
  onView: (view: View) => void;
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
      className="z-40 flex h-(--toolbar-height) shrink-0 items-center gap-2.5 border-b border-border"
      style={dragRegion("drag")}
    >
      <span className="shrink-0 text-[13px] font-semibold tracking-tight">
        Celery
      </span>
      <div className="shrink-0" style={dragRegion("no-drag")}>
        <SegmentedControl<View>
          size="md"
          // Ordered by how often they get reached for: finding a mod
          // first, then comparing them, then the structural view.
          options={[
            {
              value: "grid",
              label: "grid",
              selected: view === "grid",
              icon: <LayoutGridIcon aria-hidden className="size-3.5" />,
            },
            {
              value: "list",
              label: "list",
              selected: view === "list",
              icon: <ListIcon aria-hidden className="size-3.5" />,
            },
            {
              value: "graph",
              label: "graph",
              selected: view === "graph",
              icon: <NetworkIcon aria-hidden className="size-3.5" />,
            },
          ]}
          onSelect={onView}
        />
      </div>
      {/* Everything right of here shrinks first, so the bar survives the
          window's 800px minimum with either platform's buttons on it. */}
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
          className="h-7 w-full max-w-56 min-w-24 rounded-md border border-input bg-transparent px-2 text-xs text-foreground transition-colors outline-none placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
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

// A readout, not a control panel — except for the two counts that ask
// something of you. Those are chips, and clicking one opens its review,
// so the number and the thing you do about it are the same target. The
// rest is text and looks like it.
export function StatusBar({
  folder,
  total,
  enabled,
  updates,
  orphans,
  onReviewUpdates,
  onReviewOrphans,
}: {
  folder: string;
  total: number;
  enabled: number;
  updates: number;
  orphans: number;
  onReviewUpdates: () => void;
  onReviewOrphans: () => void;
}) {
  return (
    <footer className="flex h-6.5 shrink-0 items-center gap-3 border-t border-border px-[var(--chrome-pad)]">
      <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground/60">
        {folder}
      </span>
      <span className="tabular shrink-0 text-[10px] text-muted-foreground/60">
        {total} mods, {enabled} enabled
      </span>
      {updates > 0 && (
        <CountChip
          onClick={onReviewUpdates}
          title="review the newer builds on GameBanana"
        >
          {updates} updates
        </CountChip>
      )}
      {orphans > 0 && (
        <CountChip
          tone="warn"
          onClick={onReviewOrphans}
          title="review what nothing enabled needs"
        >
          {orphans} orphans
        </CountChip>
      )}
    </footer>
  );
}

function CountChip({
  tone,
  title,
  onClick,
  children,
}: {
  tone?: "warn";
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "tabular flex shrink-0 cursor-pointer items-center gap-1 rounded border px-1.5 py-px text-[10px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        tone === "warn"
          ? "border-warn/40 text-warn hover:bg-warn/10"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
      <ChevronRightIcon aria-hidden className="size-2.5" />
    </button>
  );
}
