import { DownloadIcon } from "lucide-react";
import type {
  ModFile,
  RemoteFileStatus,
  RemoteProgress,
} from "@shared/schemas";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ReviewDialog } from "@/components/ui/review-dialog";
import { displayName, formatBytes } from "@/lib/utils";

// The other status-bar count that asks something of you. Same review
// shape as orphans; what differs is that this one runs downloads, so
// rows report their own progress in place of their version and size.

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
  return (
    <ReviewDialog<Outdated>
      open={open}
      title="updates"
      blurb="GameBanana has newer builds of these. Each zip is replaced under the same file name, so enabled state and favourites are kept."
      groups={[{ key: "outdated", items: outdated }]}
      keyOf={(row) => row.file.fileName}
      nameOf={(row) => displayName(row.file.fileName)}
      renderDetail={({ file, remote }) => {
        const step = progress.get(remote.name);
        if (step) return <ProgressNote step={step} />;
        return (
          <>
            <span className="tabular shrink-0 text-[10px] text-muted-foreground/60">
              {file.entries[0]?.version ?? "?"} →{" "}
              <span className="text-foreground/80">{remote.latestVersion}</span>
            </span>
            <span className="tabular w-16 shrink-0 text-right text-[10px] text-muted-foreground/70">
              {formatBytes(remote.latestSizeBytes)}
            </span>
          </>
        );
      }}
      renderSummary={(chosen) =>
        `${chosen.length} selected, ${formatBytes(
          chosen.reduce((sum, row) => sum + row.remote.latestSizeBytes, 0),
        )} to download`
      }
      busy={busy}
      onClose={onClose}
      actions={[
        {
          label: (count) => (busy ? "updating…" : `update ${count}`),
          icon: <DownloadIcon />,
          onRun: (chosen) => onUpdate(chosen.map((row) => row.file.fileName)),
        },
      ]}
    />
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
  const pct =
    step.totalBytes > 0
      ? Math.round((step.receivedBytes / step.totalBytes) * 100)
      : null;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <ProgressBar
        className="w-16"
        receivedBytes={step.receivedBytes}
        totalBytes={step.totalBytes}
      />
      <span className="tabular w-8 text-right text-[10px] text-muted-foreground">
        {pct === null ? "" : `${pct}%`}
      </span>
    </span>
  );
}
