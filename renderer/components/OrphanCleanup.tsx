import { Trash2Icon } from "lucide-react";
import type { ModFile } from "@shared/schemas";
import { ReviewDialog } from "@/components/ui/review-dialog";
import { displayName, formatBytes } from "@/lib/utils";

// Orphans are one of the two things the app finds that the user is
// expected to act on, so the count in the status bar opens straight into
// this. Two ways out: disabling stops Everest loading them and is
// reversible from here, trashing reclaims the disk and is only
// reversible from the OS.

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
  return (
    <ReviewDialog<ModFile>
      open={open}
      title="orphans"
      blurb="Enabled, but nothing else enabled needs them, so Everest loads them for nothing. Starred mods are never counted as orphans."
      items={orphans}
      keyOf={(file) => file.fileName}
      nameOf={(file) => displayName(file.fileName)}
      renderDetail={(file) => (
        <span className="tabular shrink-0 text-[10px] text-muted-foreground/70">
          {formatBytes(file.sizeBytes)}
        </span>
      )}
      summary={(chosen) =>
        `${chosen.length} selected, ${formatBytes(
          chosen.reduce((sum, file) => sum + file.sizeBytes, 0),
        )}`
      }
      busy={busy}
      onClose={onClose}
      actions={[
        {
          label: () => "disable",
          variant: "outline",
          title: "stop Everest loading them, keep the files",
          onRun: (chosen) => onDisable(chosen.map((f) => f.fileName)),
        },
        {
          label: () => "move to trash",
          variant: "destructive",
          icon: <Trash2Icon />,
          title: "move the zips to the trash",
          onRun: (chosen) => onTrash(chosen.map((f) => f.fileName)),
        },
      ]}
    />
  );
}
