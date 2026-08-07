import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

// A dependency that is referenced by installed mods but not present in
// the Mods folder — rendered as a dashed placeholder pill so the gap
// is visible (and installable) right where it belongs in the graph.

export type GhostNodeData = {
  name: string;
  neededBy: number;
};
export type GhostFlowNode = Node<GhostNodeData, "ghost">;

export function GhostNode({ data, selected }: NodeProps<GhostFlowNode>) {
  return (
    <div
      className={cn(
        "flex h-full items-center gap-1.5 rounded-full border border-dashed bg-transparent px-2.5",
        selected ? "border-ring ring-3 ring-ring/40" : "border-destructive/60",
      )}
      title={`missing — needed by ${data.neededBy} installed ${data.neededBy === 1 ? "mod" : "mods"}`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-destructive/70"
      />
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground italic">
        {data.name}
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}
