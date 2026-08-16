import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The caller computes `selected` per option so one control can drive
// asymmetric logic (songloupe's API).
//
// `md` is for a control that is the primary thing on its bar; `sm` (the
// default) is for the secondary ones sitting next to it.
export function SegmentedControl<T extends string>({
  options,
  onSelect,
  size = "sm",
  className,
}: {
  options: { value: T; label: string; selected: boolean; icon?: ReactNode }[];
  onSelect: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const md = size === "md";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center overflow-hidden rounded-md border border-border bg-background/30",
        md ? "h-8 text-[13px]" : "h-7 text-xs",
        className,
      )}
    >
      {options.map((option, i) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          aria-pressed={option.selected}
          className={cn(
            // No corner rounding per segment: the container's
            // overflow-hidden clips the first and last against its own
            // radius. The focus ring is inset for the same reason: an
            // outward ring would be clipped away entirely.
            "flex h-full cursor-pointer items-center gap-1.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
            md ? "px-3" : "px-2",
            i > 0 && "border-l border-border",
            // The selected segment wears the accent gradient flat. The
            // raised-key treatment stays reserved for the button that
            // acts.
            option.selected
              ? "gradient-accent text-primary-foreground"
              : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
