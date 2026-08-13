import type { ReactNode } from "react";

// The mods/dependencies split is the app's main claim about a folder —
// these are the things you play, everything below is what they dragged
// in — so it gets a header that says it in words and sticks while you
// scroll past a hundred helpers.

const NOTE: Record<string, string> = {
  mods: "what you play, and the tools you run",
  dependencies: "pulled in by the mods above",
};

export function BrowseSection({
  label,
  count,
  children,
}: {
  label: "mods" | "dependencies";
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section>
      <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-baseline gap-2 border-b border-border bg-background/85 px-1 py-1.5 backdrop-blur-sm">
        <h2 className="text-[11px] font-semibold tracking-wide text-foreground uppercase">
          {label}
        </h2>
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground/70">
          {NOTE[label]}
        </span>
        <span className="tabular shrink-0 text-[11px] text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}
