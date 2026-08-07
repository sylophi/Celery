import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { StarIcon } from "lucide-react";
import type { ModFile } from "@shared/schemas";
import { displayName } from "@/App";
import { cn } from "@/lib/utils";

export type ModNodeData = {
  file: ModFile;
  orphan: boolean;
  missing: number;
  // True when something depends on this mod — dependencies render as
  // compact pills, distinct from the card shape of top-level mods.
  hasDependents: boolean;
};
export type ModFlowNode = Node<ModNodeData, "mod">;

// Two node shapes: top-level mods are two-line cards, dependencies are
// slim single-line pills. The layout reads these to size bands.
export const CARD_HEIGHT = 46;
export const PILL_HEIGHT = 30;

export function nodeHeight(isDependency: boolean): number {
  return isDependency ? PILL_HEIGHT : CARD_HEIGHT;
}

export function nodeWidth(label: string, isDependency: boolean): number {
  return isDependency
    ? Math.min(210, Math.max(90, Math.round(label.length * 6.1) + 44))
    : Math.min(240, Math.max(130, Math.round(label.length * 6.6) + 58));
}

export function ModNode({ data, selected }: NodeProps<ModFlowNode>) {
  const { file } = data;
  const name = displayName(file.fileName);
  const version = file.entries[0]?.version ?? "";

  if (data.hasDependents) {
    return (
      <div
        className={cn(
          "flex h-full items-center gap-1.5 rounded-full border bg-card px-2.5",
          selected ? "border-ring ring-3 ring-ring/40" : "border-border",
        )}
      >
        <Handle type="target" position={Position.Top} isConnectable={false} />
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            file.enabled ? "bg-on" : "bg-muted-foreground/40",
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[11px]",
            file.enabled ? "text-card-foreground/80" : "text-muted-foreground",
          )}
        >
          {name}
        </span>
        {file.favorite && (
          <StarIcon className="size-2.5 shrink-0 fill-current text-muted-foreground" />
        )}
        {data.orphan && (
          <span
            aria-hidden
            title="nothing enabled needs this"
            className="size-1 shrink-0 rounded-full bg-warn"
          />
        )}
        {(data.missing > 0 || file.parseError !== undefined) && (
          <span
            aria-hidden
            title={file.parseError ?? `${data.missing} missing dependencies`}
            className="size-1 shrink-0 rounded-full bg-destructive"
          />
        )}
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-full rounded-lg border bg-card px-2.5 py-1.5",
        selected ? "border-ring ring-3 ring-ring/40" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            file.enabled ? "bg-on" : "bg-muted-foreground/40",
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs",
            file.enabled
              ? "font-medium text-card-foreground"
              : "text-muted-foreground",
          )}
        >
          {name}
        </span>
        {file.favorite && (
          <StarIcon className="size-2.5 shrink-0 fill-current text-muted-foreground" />
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
        <span className="tabular truncate">{version}</span>
        {data.orphan && <span className="shrink-0 text-warn">orphan</span>}
        {data.missing > 0 && (
          <span className="shrink-0 text-destructive">
            {data.missing} missing
          </span>
        )}
        {file.parseError && (
          <span className="shrink-0 text-destructive" title={file.parseError}>
            no manifest
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}
