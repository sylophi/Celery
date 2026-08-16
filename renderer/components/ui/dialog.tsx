import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// Minimal modal shell: the page dims and blurs behind a glass panel.
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus into the dialog on open so Tab starts inside it and
  // keyboard events originate under [data-popup] (which the app-level
  // key handler treats as "a dialog owns the keyboard").
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div
      role="presentation"
      // The scrim dims but does not blur: a viewport-wide backdrop-filter
      // would re-run on every aurora frame for as long as the dialog is
      // open, and under the panel's own glass it is invisible anyway.
      className="fixed inset-0 isolate z-50 flex items-start justify-center bg-background/60 p-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-popup=""
        className={cn(
          "glass hairline-t relative w-full max-w-md rounded-xl border border-border p-4 text-sm text-popover-foreground shadow-floating",
          className,
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">{title}</h2>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="close"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
