import { cn } from "@/lib/utils";

export type Status = { text: string; kind: "ok" | "error"; nonce: number };

// Quiet status feedback instead of toasts: a single aria-live pill,
// bottom-right, that self-dismisses. The fade-out is pure CSS — the
// keyed animation restarts whenever a new status lands (nonce breaks
// ties for repeated identical messages). Write failures render here in
// destructive colors so a failed toggle is never silent.
export function StatusPill({ status }: { status: Status | null }) {
  if (!status) return null;
  const isError = status.kind === "error";
  return (
    <div
      key={status.nonce}
      aria-live="polite"
      className={cn(
        "shadow-floating pointer-events-none fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 backdrop-blur select-none",
        isError ? "border-destructive/40" : "border-border",
        // Errors hold twice as long before fading.
        isError ? "status-pill-fade-slow" : "status-pill-fade",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isError ? "bg-destructive" : "bg-on",
        )}
      />
      <span
        className={cn(
          "max-w-sm truncate text-xs",
          isError ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {status.text}
      </span>
    </div>
  );
}
