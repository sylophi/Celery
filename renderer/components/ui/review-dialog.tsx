import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { cn } from "@/lib/utils";

// "Here is what I found, untick what you want to keep, then act on the
// rest." Every finding the app expects you to deal with (orphans,
// unused mods, out-of-date ones) is that same shape, so the selection
// state, the list chrome and the footer live here and the callers
// supply only what differs: the blurb, the per-row detail, and what the
// buttons do.

export type ReviewAction<T> = {
  label: (count: number) => string;
  variant?: "default" | "outline" | "destructive";
  icon?: ReactNode;
  title?: string;
  onRun: (chosen: T[]) => void;
};

export function ReviewDialog<T>({
  open,
  title,
  blurb,
  items,
  keyOf,
  nameOf,
  renderDetail,
  summary,
  busy,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  blurb: ReactNode;
  items: T[];
  keyOf: (item: T) => string;
  nameOf: (item: T) => string;
  renderDetail: (item: T) => ReactNode;
  // The running total, phrased by the caller since only it knows what
  // the number means (disk reclaimed, bytes to download).
  summary: (chosen: T[]) => string;
  busy: boolean;
  onClose: () => void;
  actions: ReviewAction<T>[];
}) {
  // Everything starts checked; unticking is how you rescue the one item
  // you keep on purpose. Keyed, so the set survives the list rescanning
  // underneath it.
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const chosen = items.filter((item) => !excluded.has(keyOf(item)));

  // Cleared on open rather than on close: an action closes the dialog
  // through the caller's own state, so resetting on the way out catches
  // no path but Cancel, and the next visit opens with stale ticks and a
  // dead button.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setExcluded(new Set());
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-lg">
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{blurb}</p>

        <ul className="max-h-72 overflow-y-auto rounded-md border border-border">
          {items.map((item) => {
            const key = keyOf(item);
            const checked = !excluded.has(key);
            return (
              <li key={key} className="border-b border-border last:border-b-0">
                <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 transition-colors hover:bg-accent/70">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={() =>
                      setExcluded((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(key);
                        else next.delete(key);
                        return next;
                      })
                    }
                    className="size-3 shrink-0 accent-[var(--ring)]"
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs",
                      checked ? "text-foreground" : "text-muted-foreground/60",
                    )}
                  >
                    {nameOf(item)}
                  </span>
                  {renderDetail(item)}
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <span className="tabular min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {summary(chosen)}
          </span>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
            cancel
          </Button>
          {actions.map((action) => (
            <Button
              key={action.label(0)}
              size="sm"
              variant={action.variant ?? "default"}
              disabled={busy || chosen.length === 0}
              {...(action.title !== undefined ? { title: action.title } : {})}
              onClick={() => action.onRun(chosen)}
            >
              {action.icon}
              {action.label(chosen.length)}
            </Button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
