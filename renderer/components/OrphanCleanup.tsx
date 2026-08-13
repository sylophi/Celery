import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import type { ModFile } from "@shared/schemas";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn, displayName, formatBytes } from "@/lib/utils";

// Orphans are the one thing the app finds that the user is expected to
// act on, so the shortlist comes with the action attached. Two ways out:
// disabling stops Everest loading them and is reversible from here,
// trashing reclaims the disk and is only reversible from the OS.

export function OrphanBar({
  orphans,
  onReview,
}: {
  orphans: ModFile[];
  onReview: () => void;
}) {
  const bytes = orphans.reduce((sum, file) => sum + file.sizeBytes, 0);
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-warn/8 px-4 py-1.5">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        <span className="text-foreground">
          {orphans.length} {orphans.length === 1 ? "orphan" : "orphans"}
        </span>{" "}
        loading for nothing, {formatBytes(bytes)} on disk
      </span>
      <Button variant="outline" size="sm" onClick={onReview}>
        clean up
      </Button>
    </div>
  );
}

export function OrphanDialog({
  open,
  orphans,
  busy,
  onClose,
  onDisable,
  onTrash,
}: {
  open: boolean;
  orphans: ModFile[];
  busy: boolean;
  onClose: () => void;
  onDisable: (fileNames: string[]) => void;
  onTrash: (fileNames: string[]) => void;
}) {
  // Everything starts checked, and unchecking is how you rescue the one
  // helper you keep around on purpose. Keyed by file name so the set
  // survives the list rescanning underneath it.
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const chosen = orphans.filter((file) => !excluded.has(file.fileName));
  const bytes = chosen.reduce((sum, file) => sum + file.sizeBytes, 0);

  const close = () => {
    setExcluded(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="orphans" className="max-w-lg">
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Enabled, but nothing else enabled needs them, so Everest loads them
          for nothing. Starred mods are never counted as orphans.
        </p>

        <ul className="max-h-72 overflow-y-auto rounded-md border border-border">
          {orphans.map((file) => {
            const checked = !excluded.has(file.fileName);
            return (
              <li
                key={file.fileName}
                className="border-b border-border last:border-b-0"
              >
                <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setExcluded((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(file.fileName);
                        else next.delete(file.fileName);
                        return next;
                      })
                    }
                    className="size-3 shrink-0 accent-foreground"
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs",
                      checked ? "text-foreground" : "text-muted-foreground/60",
                    )}
                  >
                    {displayName(file.fileName)}
                  </span>
                  <span className="tabular shrink-0 text-[10px] text-muted-foreground/70">
                    {formatBytes(file.sizeBytes)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <span className="tabular min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {chosen.length} selected, {formatBytes(bytes)}
          </span>
          <Button variant="ghost" size="sm" onClick={close}>
            cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || chosen.length === 0}
            title="stop Everest loading them, keep the files"
            onClick={() => onDisable(chosen.map((f) => f.fileName))}
          >
            disable
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy || chosen.length === 0}
            title="move the zips to the trash"
            onClick={() => onTrash(chosen.map((f) => f.fileName))}
          >
            <Trash2Icon />
            move to trash
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
