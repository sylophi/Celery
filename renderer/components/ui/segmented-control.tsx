import { cn } from "@/lib/utils";

// The caller computes `selected` per option so one control can drive
// asymmetric logic (songloupe's API).
export function SegmentedControl<T extends string>({
  options,
  onSelect,
  className,
}: {
  options: { value: T; label: string; selected: boolean }[];
  onSelect: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-7 shrink-0 items-center rounded-md border border-border text-xs",
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
            "h-full cursor-pointer px-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            i > 0 && "border-l border-border",
            i === 0 && "rounded-l-md",
            i === options.length - 1 && "rounded-r-md",
            option.selected
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
