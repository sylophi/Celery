export type Status = { text: string; nonce: number };

// Quiet status feedback instead of toasts: a single aria-live pill,
// bottom-right, that self-dismisses. The fade-out is pure CSS — the
// keyed animation restarts whenever a new status lands (nonce breaks
// ties for repeated identical messages). Errors render inline where
// they happen; this only reports successful writes.
export function StatusPill({ status }: { status: Status | null }) {
  if (!status) return null;
  return (
    <div
      key={status.nonce}
      aria-live="polite"
      className="status-pill-fade shadow-floating pointer-events-none fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-1.5 backdrop-blur select-none"
    >
      <span className="size-1.5 rounded-full bg-on" />
      <span className="text-xs text-muted-foreground">{status.text}</span>
    </div>
  );
}
