import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { StarIcon } from "lucide-react";
import type { ModFile } from "@shared/schemas";
import { FINDING, type IdleKind } from "@/lib/findings";
import { cn, displayName } from "@/lib/utils";

export type ModNodeData = {
  file: ModFile;
  idle: IdleKind | undefined;
  missing: number;
  // True when something depends on this mod: dependencies render as
  // compact pills, distinct from the card shape of top-level mods.
  hasDependents: boolean;
  // How many top-level mods pull this one in, for helpers sitting on the
  // shared shelf. The overview draws no edges up to them, so the count
  // is what carries "lots of things need this".
  usedBy?: number;
};
export type ModFlowNode = Node<ModNodeData, "mod">;

// The one way a selected graph node is marked, shared by both node
// shapes here and by GhostNode.
export const SELECTED_NODE = "border-ring ring-3 ring-ring/40";

// Two node shapes: top-level mods are two-line cards, dependencies are
// slim single-line pills. The layout reads these to size bands.
export const CARD_HEIGHT = 46;
export const PILL_HEIGHT = 30;

export function nodeHeight(isDependency: boolean): number {
  return isDependency ? PILL_HEIGHT : CARD_HEIGHT;
}

// `badge` reserves room for the use count on a shared helper, so the
// label truncates at the same place with or without one.
export function nodeWidth(
  label: string,
  isDependency: boolean,
  badge = false,
): number {
  return isDependency
    ? Math.min(210, Math.max(90, Math.round(label.length * 6.1) + 44)) +
        (badge ? 18 : 0)
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
          selected ? SELECTED_NODE : "border-border",
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
        {data.usedBy !== undefined && data.usedBy > 1 && (
          <span
            title={`${data.usedBy} mods need this`}
            className="tabular shrink-0 rounded-full bg-muted px-1 text-[9px] text-muted-foreground"
          >
            {data.usedBy}
          </span>
        )}
        {file.favorite && (
          <StarIcon className="size-2.5 shrink-0 fill-current text-muted-foreground" />
        )}
        {data.idle !== undefined && (
          <span
            aria-hidden
            title={FINDING[data.idle].hint}
            className={cn(
              "size-1 shrink-0 rounded-full",
              FINDING[data.idle].dot,
            )}
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
        selected ? SELECTED_NODE : "border-border",
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
        {data.idle !== undefined && (
          <span
            title={FINDING[data.idle].hint}
            className={cn("shrink-0", FINDING[data.idle].text)}
          >
            {FINDING[data.idle].label}
          </span>
        )}
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
