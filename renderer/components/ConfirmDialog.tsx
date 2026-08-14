import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { displayName } from "@/lib/utils";

export type PendingAction = {
  title: string;
  sections: { label: string; items: string[] }[];
  confirmLabel: string;
  changes: { fileName: string; enabled: boolean }[];
  message: string;
};

// Cascade preview: nothing is written until the user has seen exactly
// which files the dependency closure drags along.
export function ConfirmDialog({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: PendingAction | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={pending !== null}
      onClose={onCancel}
      title={pending?.title ?? ""}
    >
      {pending && (
        <div className="flex flex-col gap-3">
          {pending.sections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <div key={section.label}>
                <h3 className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {section.label}
                </h3>
                <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="truncate border-b border-border px-2 py-1 text-xs text-foreground last:border-b-0"
                    >
                      {displayName(item)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={onConfirm}>
              {pending.confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
