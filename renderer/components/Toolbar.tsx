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
import { FINDING, type Finding } from "@/lib/findings";
import { cn, dragRegion, plural } from "@/lib/utils";

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
      // A translucent wash over the sky (no blur: nothing but the
      // atmosphere is ever behind this bar), closed off by the aurora
      // hairline instead of a border — the bar's bottom edge is the
      // app's one full statement of the triad, and everything below
      // borrows pieces of it.
      className="z-40 flex h-(--toolbar-height) shrink-0 items-center gap-2.5 bg-background/70 hairline-b"
      style={dragRegion("drag")}
    >
      <span className="shrink-0 gradient-accent-text text-[13px] font-semibold tracking-tight">
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
          className="h-7 w-full max-w-56 min-w-24 rounded-md border border-input bg-background/30 px-2 text-xs text-foreground transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground/70 hover:border-ring/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
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

// A readout, not a control panel, except for the counts that ask
// something of you. Those are chips wearing their finding's hue, and
// clicking one opens its review, so the number and the thing you do
// about it are the same target. The rest is text and looks like it.
export function StatusBar({
  folder,
  total,
  enabled,
  updates,
  unused,
  orphans,
  onReviewUpdates,
  onReviewUnused,
  onReviewOrphans,
}: {
  folder: string;
  total: number;
  enabled: number;
  updates: number;
  // Never summed into one count: these are separate problems with
  // separate answers, and each chip opens the review that gives its own.
  unused: number;
  orphans: number;
  onReviewUpdates: () => void;
  onReviewUnused: () => void;
  onReviewOrphans: () => void;
}) {
  return (
    <footer className="flex h-6.5 shrink-0 items-center gap-3 bg-background/70 hairline-t px-[var(--chrome-pad)]">
      <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground/60">
        {folder}
      </span>
      <span className="tabular shrink-0 text-[10px] text-muted-foreground/60">
        {total} mods, {enabled} enabled
      </span>
      {updates > 0 && (
        <CountChip
          tone="update"
          onClick={onReviewUpdates}
          title="review the newer builds on GameBanana"
        >
          {plural(updates, "update")}
        </CountChip>
      )}
      {unused > 0 && (
        <CountChip
          tone="unused"
          onClick={onReviewUnused}
          title="loaded for nothing, because the mods that want them are disabled"
        >
          {unused} unused
        </CountChip>
      )}
      {orphans > 0 && (
        <CountChip
          tone="orphan"
          onClick={onReviewOrphans}
          title="loaded for nothing, and nothing installed asks for them"
        >
          {plural(orphans, "orphan")}
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
  tone: Finding;
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
        FINDING[tone].chip,
      )}
    >
      {children}
      <ChevronRightIcon aria-hidden className="size-2.5" />
    </button>
  );
}
