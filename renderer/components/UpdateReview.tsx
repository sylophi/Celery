import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import type {
  ModFile,
  RemoteFileStatus,
  RemoteProgress,
} from "@shared/schemas";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn, displayName, formatBytes } from "@/lib/utils";

// The counterpart to the orphan review: the other status-bar count that
// asks something of you. Same shape deliberately — tick what you want,
// see the total, act once — but this one runs downloads, so rows report
// their own progress in place rather than the whole thing going busy.

export type Outdated = {
  file: ModFile;
  remote: RemoteFileStatus;
};

export function UpdateDialog({
  open,
  outdated,
  busy,
  progress,
  onClose,
  onUpdate,
}: {
  open: boolean;
  outdated: Outdated[];
  busy: boolean;
  // Keyed by mod Name, which is what downloads are reported under.
  progress: Map<string, RemoteProgress>;
  onClose: () => void;
  onUpdate: (fileNames: string[]) => void;
}) {
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const chosen = outdated.filter((row) => !excluded.has(row.file.fileName));
  const bytes = chosen.reduce(
    (sum, row) => sum + row.remote.latestSizeBytes,
    0,
  );

  const close = () => {
    setExcluded(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="updates" className="max-w-lg">
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          GameBanana has newer builds of these. Each zip is replaced under the
          same file name, so enabled state and favourites are kept.
        </p>

        <ul className="max-h-72 overflow-y-auto rounded-md border border-border">
          {outdated.map(({ file, remote }) => {
            const checked = !excluded.has(file.fileName);
            const step = progress.get(remote.name);
            return (
              <li
                key={file.fileName}
                className="border-b border-border last:border-b-0"
              >
                <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
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
                  {step ? (
                    <ProgressNote step={step} />
                  ) : (
                    <>
                      <span className="tabular shrink-0 text-[10px] text-muted-foreground/60">
                        {file.entries[0]?.version ?? "?"} →{" "}
                        <span className="text-foreground/80">
                          {remote.latestVersion}
                        </span>
                      </span>
                      <span className="tabular w-16 shrink-0 text-right text-[10px] text-muted-foreground/70">
                        {formatBytes(remote.latestSizeBytes)}
                      </span>
                    </>
                  )}
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <span className="tabular min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {chosen.length} selected, {formatBytes(bytes)} to download
          </span>
          <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
            cancel
          </Button>
          <Button
            size="sm"
            disabled={busy || chosen.length === 0}
            onClick={() => onUpdate(chosen.map((row) => row.file.fileName))}
          >
            <DownloadIcon />
            {busy ? "updating…" : `update ${chosen.length}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ProgressNote({ step }: { step: RemoteProgress }) {
  if (step.phase === "error") {
    return (
      <span
        className="shrink-0 text-[10px] text-destructive"
        title={step.error ?? "failed"}
      >
        failed
      </span>
    );
  }
  if (step.phase === "done") {
    return <span className="shrink-0 text-[10px] text-on">done</span>;
  }
  if (step.phase === "verifying") {
    return (
      <span className="shrink-0 text-[10px] text-muted-foreground">
        verifying…
      </span>
    );
  }
  // A server that sent no content-length leaves nothing to divide by.
  const pct =
    step.totalBytes > 0
      ? Math.round((step.receivedBytes / step.totalBytes) * 100)
      : null;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${pct ?? 100}%` }}
        />
      </span>
      <span className="tabular w-8 text-right text-[10px] text-muted-foreground">
        {pct === null ? "" : `${pct}%`}
      </span>
    </span>
  );
}
