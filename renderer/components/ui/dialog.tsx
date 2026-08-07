import { useEffect, type ReactNode } from "react";
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

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 isolate z-50 flex items-start justify-center bg-background/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
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
          <Button variant="ghost" size="icon-xs" aria-label="close" onClick={onClose}>
            <XIcon />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
