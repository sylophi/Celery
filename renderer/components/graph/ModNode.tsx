import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { StarIcon } from "lucide-react";
import type { ModFile } from "@shared/schemas";
import { displayName } from "@/App";
import { cn } from "@/lib/utils";

export type ModNodeData = {
  file: ModFile;
  orphan: boolean;
  missing: number;
  // True when something depends on this mod — library mods read
  // quieter than the top-level mods you actually play.
  hasDependents: boolean;
};
export type ModFlowNode = Node<ModNodeData, "mod">;

export const NODE_HEIGHT = 46;

export function nodeWidth(label: string): number {
  return Math.min(240, Math.max(130, Math.round(label.length * 6.6) + 58));
}

export function ModNode({ data, selected }: NodeProps<ModFlowNode>) {
  const { file } = data;
  const name = displayName(file.fileName);
  const version = file.entries[0]?.version ?? "";
  return (
    <div
      className={cn(
        "h-full rounded-lg border bg-card px-2.5 py-1.5 transition-colors",
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
            file.enabled && !data.hasDependents
              ? "font-medium text-card-foreground"
              : "text-muted-foreground",
            !file.enabled && "text-muted-foreground",
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
