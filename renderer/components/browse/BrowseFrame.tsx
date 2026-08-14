import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { ModIndex, Orphan } from "@shared/graph";
import type { ModFile, RemoteFileStatus } from "@shared/schemas";
import { BrowseHeader } from "./BrowseHeader";
import { BrowseSection } from "./Section";
import { makeComparator, type SortMode } from "./sort";

// The frame the two browse views share. They differ in how they draw a
// mod, not in what they are drawing, so drawing one mod is all they
// supply — everything else (the header, the scroll box, the
// mods/dependencies split, the empty state) lives here once.

// Everything a view needs to render its own items, passed straight
// through from App.
export type BrowseProps = {
  files: ModFile[];
  total: number;
  query: string;
  sort: SortMode;
  onSort: (sort: SortMode) => void;
  // Keyed by file name, absent when the mod is not an orphan; the value
  // carries which kind, which is what the views actually draw.
  orphans: Map<string, Orphan>;
  updates: Set<string>;
  index: ModIndex;
  dependencySet: Set<string>;
  remoteOf: (fileName: string) => RemoteFileStatus | undefined;
  selectedId: string | null;
  onSelect: (fileName: string | null) => void;
};

const ScrollerContext = createContext<RefObject<HTMLElement | null> | null>(
  null,
);

// The scroll box itself, for items that have to observe against it
// rather than the viewport (an IntersectionObserver rooted at the
// viewport is clipped by this element and never sees the margin).
export function useBrowseScroller(): RefObject<HTMLElement | null> {
  const scroller = useContext(ScrollerContext);
  if (!scroller) throw new Error("useBrowseScroller outside a BrowseFrame");
  return scroller;
}

export function BrowseFrame({
  files,
  total,
  query,
  sort,
  onSort,
  dependencySet,
  remoteOf,
  className,
  gapClassName,
  listClassName,
  renderItem,
}: BrowseProps & {
  className?: string;
  gapClassName: string;
  listClassName: string;
  renderItem: (file: ModFile) => ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const comparator = makeComparator(sort, (f) => remoteOf(f)?.category);
  const section = (label: "mods" | "dependencies", list: ModFile[]) => (
    <BrowseSection label={label} count={list.length}>
      <ul className={listClassName}>{list.map(renderItem)}</ul>
    </BrowseSection>
  );

  return (
    <div className={className}>
      <BrowseHeader
        shown={files.length}
        total={total}
        query={query}
        sort={sort}
        onSort={onSort}
      />
      {/* No top padding on the scroll box itself: `sticky top-0`
          resolves against its padding edge, so any would leave a band
          above the section headers for rows to show through. */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {files.length === 0 ? (
          <p className="py-16 text-center text-xs text-muted-foreground/60">
            no mod matches
          </p>
        ) : (
          <ScrollerContext value={scroller}>
            <div className={`flex flex-col pt-3 ${gapClassName}`}>
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
          </ScrollerContext>
        )}
      </div>
    </div>
  );
}
