import { PowerOffIcon } from "lucide-react";
import type { ModFile } from "@shared/schemas";
import { ReviewDialog } from "@/components/ui/review-dialog";
import { displayName, formatBytes } from "@/lib/utils";

// Unused: enabled, and mods DO ask for them — every one of those mods
// just happens to be disabled. So they are loading for nobody, and the
// answer is to stop loading them. Deleting is not offered: these are
// wanted, and the mods that want them would come back broken. Nothing
// is lost by disabling either, since re-enabling one of those mods
// pulls its dependencies in again.

export type UnusedRow = { file: ModFile; wantedBy: string[] };

export function UnusedDialog({
  open,
  unused,
  busy,
  onClose,
  onDisable,
}: {
  open: boolean;
  unused: UnusedRow[];
  busy: boolean;
  onClose: () => void;
  onDisable: (fileNames: string[]) => void;
}) {
  return (
    <ReviewDialog<UnusedRow>
      open={open}
      title="unused"
      blurb="Enabled, but the only mods that ask for them are disabled, so Everest loads them for nothing. Turning one off costs nothing: enabling a mod that wants it brings it straight back."
      items={unused}
      keyOf={(row) => row.file.fileName}
      nameOf={(row) => displayName(row.file.fileName)}
      renderDetail={({ file, wantedBy }) => (
        <>
          <span
            className="shrink-0 text-[10px] text-muted-foreground/70"
            title={`wanted by ${wantedBy.map(displayName).join(", ")}`}
          >
            {wantedBy.length} disabled
          </span>
          <span className="tabular w-16 shrink-0 text-right text-[10px] text-muted-foreground/70">
            {formatBytes(file.sizeBytes)}
          </span>
        </>
      )}
      summary={(chosen) =>
        `${chosen.length} selected, ${formatBytes(
          chosen.reduce((sum, row) => sum + row.file.sizeBytes, 0),
        )} off the load order`
      }
      busy={busy}
      onClose={onClose}
      actions={[
        {
          label: (count) => `disable ${count}`,
          icon: <PowerOffIcon />,
          title: "stop Everest loading them, keep the files",
          onRun: (chosen) => onDisable(chosen.map((r) => r.file.fileName)),
        },
      ]}
    />
  );
}
