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
        "flex shrink-0 items-center rounded-md border border-border",
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
            "flex h-full cursor-pointer items-center gap-1.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            md ? "px-3" : "px-2",
            i > 0 && "border-l border-border",
            i === 0 && "rounded-l-md",
            i === options.length - 1 && "rounded-r-md",
            option.selected
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
