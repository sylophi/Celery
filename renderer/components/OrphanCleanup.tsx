import { Trash2Icon } from "lucide-react";
import type { ModFile } from "@shared/schemas";
import { ReviewDialog } from "@/components/ui/review-dialog";
import { displayName, formatBytes } from "@/lib/utils";

// Orphans: enabled, and no mod in the folder lists them as a
// dependency. Nothing will ever ask for them, so there is one thing to
// do about them and this is where it happens. Disabling is not offered:
// it would leave the zip on disk to be rediscovered as an orphan on
// every future scan, which is not a resolution.

export function OrphanDialog({
  open,
  orphans,
  busy,
  onClose,
  onTrash,
}: {
  open: boolean;
  orphans: ModFile[];
  busy: boolean;
  onClose: () => void;
  onTrash: (fileNames: string[]) => void;
}) {
  return (
    <ReviewDialog<ModFile>
      open={open}
      title="orphans"
      blurb="Enabled, and nothing installed asks for them — not even a disabled mod. Everest loads them for nothing and nothing is coming back for them. Starred mods are never counted as orphans."
      items={orphans}
      keyOf={(file) => file.fileName}
      nameOf={(file) => displayName(file.fileName)}
      renderDetail={(file) => (
        <span className="tabular w-16 shrink-0 text-right text-[10px] text-muted-foreground/70">
          {formatBytes(file.sizeBytes)}
        </span>
      )}
      summary={(chosen) =>
        `${chosen.length} selected, ${formatBytes(
          chosen.reduce((sum, file) => sum + file.sizeBytes, 0),
        )} reclaimed`
      }
      busy={busy}
      onClose={onClose}
      actions={[
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
