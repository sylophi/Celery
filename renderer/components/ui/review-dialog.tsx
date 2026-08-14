import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { cn } from "@/lib/utils";

// "Here is what I found, untick what you want to keep, then act on the
// rest." Both things the app finds and expects you to deal with —
// orphans and out-of-date mods — are that same shape, so the selection
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

// Rows that mean different things, and so deserve different defaults,
// split into groups. A single-group dialog is just a list and says
// nothing about it; groups only announce themselves once there is a
// distinction to draw.
export type ReviewGroup<T> = {
  key: string;
  title?: string;
  note?: string;
  items: T[];
  // Whether the group starts ticked. A group the buttons would treat
  // too bluntly opts out, so hitting one straight away does the safe
  // thing and including the rest is a deliberate click.
  checked?: boolean;
};

export function ReviewDialog<T>({
  open,
  title,
  blurb,
  groups,
  keyOf,
  nameOf,
  renderDetail,
  renderSummary,
  busy,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  blurb: ReactNode;
  groups: ReviewGroup<T>[];
  keyOf: (item: T) => string;
  nameOf: (item: T) => string;
  renderDetail: (item: T) => ReactNode;
  // The running total, phrased by the caller since only it knows what
  // the number means (disk reclaimed, bytes to download) and what about
  // the selection is worth warning over.
  renderSummary: (chosen: T[]) => ReactNode;
  busy: boolean;
  onClose: () => void;
  actions: ReviewAction<T>[];
}) {
  // Unticking is how you rescue the one item you keep on purpose. Keyed,
  // so the set survives the list rescanning underneath it.
  const defaults = () =>
    new Set(
      groups
        .filter((group) => group.checked === false)
        .flatMap((group) => group.items.map(keyOf)),
    );
  const [excluded, setExcluded] = useState<Set<string>>(defaults);

  // Rebuilt on every open rather than once at mount: the dialog is
  // mounted long before it is shown, when the lists it defaults from are
  // usually still empty.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setExcluded(defaults());
  }

  const items = groups.flatMap((group) => group.items);
  const chosen = items.filter((item) => !excluded.has(keyOf(item)));

  const setKeys = (keys: string[], checked: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (checked) next.delete(key);
        else next.add(key);
      }
      return next;
    });

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-lg">
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{blurb}</p>

        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {groups.map((group) => {
            const keys = group.items.map(keyOf);
            const picked = keys.filter((key) => !excluded.has(key)).length;
            return (
              <section key={group.key}>
                {group.title !== undefined && (
                  // Pinned so the group a row belongs to stays readable
                  // while scrolling. Opaque, or rows show through it.
                  <div className="sticky top-0 z-10 border-b border-border bg-muted px-2 py-1.5">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={picked === keys.length}
                        disabled={busy}
                        ref={(el) => {
                          if (el)
                            el.indeterminate =
                              picked > 0 && picked < keys.length;
                        }}
                        onChange={() => setKeys(keys, picked < keys.length)}
                        className="mt-0.5 size-3 shrink-0 accent-foreground"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-[10px] font-semibold tracking-wide text-foreground/80 uppercase">
                          {group.title} · {keys.length}
                        </span>
                        {group.note !== undefined && (
                          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                            {group.note}
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                )}
                <ul>
                  {group.items.map((item) => {
                    const key = keyOf(item);
                    const checked = !excluded.has(key);
                    return (
                      <li
                        key={key}
                        className="border-b border-border last:border-b-0"
                      >
                        <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-muted">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy}
                            onChange={() => setKeys([key], !checked)}
                            className="size-3 shrink-0 accent-foreground"
                          />
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-xs",
                              checked
                                ? "text-foreground"
                                : "text-muted-foreground/60",
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
              </section>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="tabular min-w-0 flex-1 text-[11px] leading-tight text-muted-foreground">
            {renderSummary(chosen)}
          </div>
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
