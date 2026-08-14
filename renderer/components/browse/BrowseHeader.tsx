import { SortSelect, type SortMode } from "./sort";

// A bar the two browse views share, above the scroll area rather than
// inside it, so sorting stays reachable a hundred helpers down. It also
// gives the sort control something to sit opposite: the count is the
// only place a search says how much it actually matched, since the
// status bar counts the folder rather than the view.

export function BrowseHeader({
  shown,
  total,
  query,
  sort,
  onSort,
}: {
  shown: number;
  total: number;
  query: string;
  sort: SortMode;
  onSort: (sort: SortMode) => void;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
      <span className="min-w-0 truncate text-[11px] text-muted-foreground">
        {query === "" ? (
          <>
            <span className="tabular text-foreground/80">{total}</span> mods
          </>
        ) : (
          <>
            <span className="tabular text-foreground/80">{shown}</span> of{" "}
            <span className="tabular">{total}</span> match “{query}”
          </>
        )}
      </span>
      <SortSelect sort={sort} onSort={onSort} />
    </div>
  );
}
