import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// Minimal modal shell: backdrop blur + centered panel elevated by a
// ring instead of a shadow (floating popovers get the shadow; modals
// sit on a dimmed page and don't need one).
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
      className="fixed inset-0 isolate z-50 flex items-start justify-center bg-background/40 p-4 pt-[12vh] backdrop-blur-[2px]"
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
          "relative w-full max-w-md rounded-xl border border-border bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/5",
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
