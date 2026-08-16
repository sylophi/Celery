import { cn } from "@/lib/utils";

// A download's progress. A server that sent no content-length leaves
// nothing to divide by, so the bar fills and pulses rather than
// pretending to a percentage.
export function ProgressBar({
  receivedBytes,
  totalBytes,
  className,
}: {
  receivedBytes: number;
  totalBytes: number;
  className?: string;
}) {
  const pct =
    totalBytes > 0 ? Math.min(100, (receivedBytes / totalBytes) * 100) : null;
  return (
    <div
      className={cn(
        "h-1 overflow-hidden rounded-full bg-muted",
        className ?? "w-full",
      )}
    >
      <div
        className={cn(
          // The accent ramp runs the direction of travel; bg-primary is
          // the floor under it.
          "gradient-accent-x h-full rounded-full bg-primary transition-[width] duration-200",
          pct === null && "animate-pulse",
        )}
        style={{ width: `${pct ?? 100}%` }}
      />
    </div>
  );
}
