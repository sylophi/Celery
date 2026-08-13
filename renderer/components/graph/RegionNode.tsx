import type { Node, NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

// Background panels the layout emits: the big labelled regions ("mods",
// "shared", "needs") and the unlabelled island frames that hold a mod
// together with the dependencies only it uses. They sit behind the mod
// nodes and swallow no clicks, so clicking one still clears the
// selection like the empty pane does.

export type RegionNodeData = {
  title: string;
  note: string;
  variant: "region" | "island";
};
export type RegionFlowNode = Node<RegionNodeData, "region">;

export function RegionNode({ data }: NodeProps<RegionFlowNode>) {
  if (data.variant === "island") {
    return (
      <div className="pointer-events-none h-full w-full rounded-xl bg-muted/25 ring-1 ring-border/40 ring-inset" />
    );
  }
  return (
    <div
      className={cn(
        "pointer-events-none h-full w-full rounded-2xl",
        "bg-muted/12 ring-1 ring-border/50 ring-inset",
      )}
    >
      <div className="flex items-baseline gap-2 px-4 pt-2">
        <span className="text-[13px] font-medium tracking-tight text-foreground/70">
          {data.title}
        </span>
        <span className="text-[11px] text-muted-foreground/60">
          {data.note}
        </span>
      </div>
    </div>
  );
}
