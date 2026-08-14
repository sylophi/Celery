import { Trash2Icon } from "lucide-react";
import type { Orphan } from "@shared/graph";
import type { ModFile } from "@shared/schemas";
import { ReviewDialog, type ReviewGroup } from "@/components/ui/review-dialog";
import { displayName, formatBytes } from "@/lib/utils";

// Orphans are one of the two things the app finds that the user is
// expected to act on, so the count in the status bar opens straight into
// this. Two ways out: disabling stops Everest loading them and is
// reversible from here, trashing reclaims the disk and is only
// reversible from the OS.
//
// Which of the two is right depends on the kind. Disabling suits both —
// a dormant helper comes back on its own when the mod that wants it is
// re-enabled — but trashing a dormant one leaves that mod broken, so
// dormant rows start unticked and the footer says what including them
// would cost.

export type OrphanRow = { file: ModFile; orphan: Orphan };

export function OrphanDialog({
  open,
  rows,
  busy,
  onClose,
  onDisable,
  onTrash,
}: {
  open: boolean;
  rows: OrphanRow[];
  busy: boolean;
  onClose: () => void;
  onDisable: (fileNames: string[]) => void;
  onTrash: (fileNames: string[]) => void;
}) {
  const of = (kind: Orphan["kind"]) =>
    rows.filter((row) => row.orphan.kind === kind);
  const groups: ReviewGroup<OrphanRow>[] = [];
  const unused = of("unused");
  const dormant = of("dormant");
  if (unused.length > 0) {
    groups.push({
      key: "unused",
      // The same two words the grid, list and graph label them with, so
      // the badge you clicked through from names the group you land in.
      title: "unused",
      note: "Nothing installed asks for these, enabled or not. Trashing them loses nothing.",
      items: unused,
    });
  }
  if (dormant.length > 0) {
    groups.push({
      key: "dormant",
      title: "dormant",
      note: "Only disabled mods ask for these. Disabling is free — enabling the mod that wants one pulls it back. Trashing means that mod returns with a missing dependency.",
      items: dormant,
      // Held back so that reaching straight for a button acts on the
      // rows nothing is holding on to. Unless these are all there is,
      // in which case they are what the dialog was opened for.
      ...(unused.length > 0 ? { checked: false } : {}),
    });
  }

  return (
    <ReviewDialog<OrphanRow>
      open={open}
      title="orphans"
      blurb="Enabled, but nothing else enabled needs them, so Everest loads them for nothing. Starred mods are never counted as orphans."
      groups={groups}
      keyOf={(row) => row.file.fileName}
      nameOf={(row) => displayName(row.file.fileName)}
      renderDetail={({ file, orphan }) => (
        <>
          {orphan.wantedBy.length > 0 && (
            <span
              className="shrink-0 text-[10px] text-muted-foreground/70"
              title={orphan.wantedBy.map(displayName).join(", ")}
            >
              {orphan.wantedBy.length} disabled
            </span>
          )}
          <span className="tabular w-16 shrink-0 text-right text-[10px] text-muted-foreground/70">
            {formatBytes(file.sizeBytes)}
          </span>
        </>
      )}
      renderSummary={(chosen) => {
        const risky = chosen.filter(
          (row) => row.orphan.kind === "dormant",
        ).length;
        return (
          <>
            <span className="block truncate">
              {chosen.length} selected,{" "}
              {formatBytes(
                chosen.reduce((sum, row) => sum + row.file.sizeBytes, 0),
              )}
            </span>
            {risky > 0 && (
              <span className="block truncate text-warn">
                trashing {risky} would break a disabled mod
              </span>
            )}
          </>
        );
      }}
      busy={busy}
      onClose={onClose}
      actions={[
        {
          label: () => "disable",
          variant: "outline",
          title: "stop Everest loading them, keep the files",
          onRun: (chosen) => onDisable(chosen.map((r) => r.file.fileName)),
        },
        {
          label: () => "move to trash",
          variant: "destructive",
          icon: <Trash2Icon />,
          title: "move the zips to the trash",
          onRun: (chosen) => onTrash(chosen.map((r) => r.file.fileName)),
        },
      ]}
    />
  );
}
