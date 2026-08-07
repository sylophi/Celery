import { useEffect, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import type { ModIndex } from "@shared/graph";
import { depClosure, dependentClosure } from "@shared/graph";
import type { GraphFilter } from "@/App";
import { displayName } from "@/App";
import { ModNode, NODE_HEIGHT, nodeWidth, type ModFlowNode } from "./ModNode";

const nodeTypes = { mod: ModNode };

// Banded layout, hand-rolled for this graph's real shape: ~150 nodes,
// shallow (2-4 hops), with a huge leaf tier. A strict layered layout
// (dagre) puts all ~80 leaf helpers in one 13000px row; instead each
// depth tier becomes a horizontal band whose nodes WRAP into a compact
// grid. Depth = longest dependent-chain above a node, so the mods you
// actually play sit in the top band and shared infrastructure sinks.
// Within a band, nodes order by the average x of their dependents in
// the bands above (one barycenter pass) so dependencies sit roughly
// under their users.
const BAND_MAX_WIDTH = 2300;
const SLOT_GAP_X = 14;
const ROW_HEIGHT = NODE_HEIGHT + 16;
const BAND_GAP = 88;

function layoutPositions(
  index: ModIndex,
  visible: Set<string>,
): Map<string, { x: number; y: number; width: number }> {
  // Union of hard+optional dependency edges restricted to the visible
  // set, plus the reverse map.
  const depsOf = new Map<string, Set<string>>();
  const dependentsOf = new Map<string, Set<string>>();
  for (const fileName of visible) {
    const deps = new Set<string>();
    for (const to of index.hardDeps.get(fileName) ?? []) {
      if (visible.has(to)) deps.add(to);
    }
    for (const to of index.optionalDeps.get(fileName) ?? []) {
      if (visible.has(to)) deps.add(to);
    }
    depsOf.set(fileName, deps);
    for (const to of deps) {
      let set = dependentsOf.get(to);
      if (!set) dependentsOf.set(to, (set = new Set()));
      set.add(fileName);
    }
  }

  // depth 0 = no dependents (top). Longest path over reverse edges,
  // memoized; cycles (shouldn't exist) break to 0.
  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (fileName: string): number => {
    const memo = depths.get(fileName);
    if (memo !== undefined) return memo;
    if (visiting.has(fileName)) return 0;
    visiting.add(fileName);
    let depth = 0;
    for (const dependent of dependentsOf.get(fileName) ?? []) {
      depth = Math.max(depth, depthOf(dependent) + 1);
    }
    visiting.delete(fileName);
    depths.set(fileName, depth);
    return depth;
  };
  for (const fileName of visible) depthOf(fileName);

  const bands: string[][] = [];
  for (const fileName of visible) {
    const depth = depths.get(fileName) ?? 0;
    (bands[depth] ??= []).push(fileName);
  }

  const out = new Map<string, { x: number; y: number; width: number }>();
  let bandY = 24;
  for (const band of bands) {
    if (!band) continue;
    // Barycenter of already-placed dependents; nodes without placed
    // dependents (top band, stragglers) keep alphabetical order.
    const keyed = band.map((fileName) => {
      const anchors = [...(dependentsOf.get(fileName) ?? [])]
        .map((d) => out.get(d))
        .filter((p) => p !== undefined);
      const barycenter =
        anchors.length > 0
          ? anchors.reduce((sum, p) => sum + p.x + p.width / 2, 0) /
            anchors.length
          : Infinity;
      return { fileName, barycenter };
    });
    keyed.sort(
      (a, b) =>
        a.barycenter - b.barycenter ||
        a.fileName.toLowerCase().localeCompare(b.fileName.toLowerCase()),
    );

    let x = 24;
    let row = 0;
    for (const { fileName } of keyed) {
      const width = nodeWidth(displayName(fileName));
      if (x + width > BAND_MAX_WIDTH && x > 24) {
        x = 24;
        row += 1;
      }
      out.set(fileName, { x, y: bandY + row * ROW_HEIGHT, width });
      x += width + SLOT_GAP_X;
    }
    bandY += (row + 1) * ROW_HEIGHT + BAND_GAP;
  }
  return out;
}

export function GraphView(props: {
  index: ModIndex;
  filter: GraphFilter;
  orphans: Set<string>;
  dependencySet: Set<string>;
  selectedId: string | null;
  onSelect: (fileName: string | null) => void;
}) {
  return (
    <ReactFlowProvider>
      <GraphViewInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphViewInner({
  index,
  filter,
  orphans,
  dependencySet,
  selectedId,
  onSelect,
}: {
  index: ModIndex;
  filter: GraphFilter;
  orphans: Set<string>;
  dependencySet: Set<string>;
  selectedId: string | null;
  onSelect: (fileName: string | null) => void;
}) {
  const visible = new Set(
    (filter === "enabled"
      ? index.files.filter((f) => f.enabled)
      : index.files
    ).map((f) => f.fileName),
  );

  const positions = layoutPositions(index, visible);

  // The selected node's neighborhood: everything it transitively needs
  // plus everything that transitively needs it.
  // Hard closure both ways, plus one hop of optional neighbors: their
  // edges are drawn as active around the selection, so the nodes they
  // point at must not be dimmed out from under them.
  const neighborhood =
    selectedId && visible.has(selectedId)
      ? new Set([
          ...depClosure(index, [selectedId]),
          ...dependentClosure(index, [selectedId]),
          ...(index.optionalDeps.get(selectedId) ?? []),
          ...(index.optionalDependents.get(selectedId) ?? []),
        ])
      : null;

  const nodes: ModFlowNode[] = (() => {
    const out: ModFlowNode[] = [];
    for (const file of index.files) {
      if (!visible.has(file.fileName)) continue;
      const pos = positions.get(file.fileName)!;
      const dimmed =
        (neighborhood && !neighborhood.has(file.fileName)) ||
        (filter === "orphans" && !orphans.has(file.fileName));
      out.push({
        id: file.fileName,
        type: "mod",
        position: { x: pos.x, y: pos.y },
        width: pos.width,
        height: NODE_HEIGHT,
        selected: file.fileName === selectedId,
        style: { opacity: dimmed ? 0.25 : 1 },
        data: {
          file,
          orphan: orphans.has(file.fileName),
          missing: index.missing.get(file.fileName)?.length ?? 0,
          hasDependents: dependencySet.has(file.fileName),
        },
      });
    }
    return out;
  })();

  const edges: Edge[] = (() => {
    const out: Edge[] = [];
    const push = (from: string, to: string, optional: boolean) => {
      if (!visible.has(from) || !visible.has(to)) return;
      const active =
        selectedId !== null && (from === selectedId || to === selectedId);
      const dimmed =
        (neighborhood && !(neighborhood.has(from) && neighborhood.has(to))) ||
        (filter === "orphans" && !(orphans.has(from) || orphans.has(to)));
      out.push({
        id: `${optional ? "o" : "h"}:${from}->${to}`,
        source: from,
        target: to,
        className: [optional && "edge-optional", active && "edge-active"]
          .filter(Boolean)
          .join(" "),
        style: dimmed ? { opacity: 0.12 } : undefined,
        markerEnd: active
          ? { type: MarkerType.ArrowClosed, width: 14, height: 14 }
          : undefined,
      });
    };
    for (const [from, deps] of index.hardDeps) {
      for (const to of deps) push(from, to, false);
    }
    // Optional-dep edges only appear around the selected node — drawn
    // for everything they add more crosshatch than information.
    if (selectedId) {
      for (const [from, deps] of index.optionalDeps) {
        for (const to of deps) {
          if (from === selectedId || to === selectedId) push(from, to, true);
        }
      }
    }
    return out;
  })();

  // Center on the newly selected node (selection can come from the
  // sidebar, far outside the viewport). The last-centered id is
  // tracked so layout churn from toggle rescans doesn't re-trigger
  // the flight for an unchanged selection.
  const { setCenter, getZoom } = useReactFlow();
  const lastCentered = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) {
      lastCentered.current = null;
      return;
    }
    if (lastCentered.current === selectedId) return;
    const pos = positions.get(selectedId);
    if (!pos) return;
    lastCentered.current = selectedId;
    setCenter(pos.x + pos.width / 2, pos.y + NODE_HEIGHT / 2, {
      zoom: Math.max(getZoom(), 0.85),
      duration: 300,
    });
  }, [selectedId, positions, setCenter, getZoom]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_event, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
      minZoom={0.05}
      maxZoom={1.5}
      panOnScroll
      zoomOnPinch
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      selectNodesOnDrag={false}
      deleteKeyCode={null}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="var(--edge-optional)"
      />
      <MiniMap
        pannable
        zoomable
        position="bottom-left"
        style={{ width: 140, height: 96 }}
      />
    </ReactFlow>
  );
}
