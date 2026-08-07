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
import { ModNode, nodeHeight, nodeWidth, type ModFlowNode } from "./ModNode";

const nodeTypes = { mod: ModNode };

// Cluster-per-component layout. Each connected component of the
// dependency graph (hard+optional edges, undirected) is laid out as its
// own banded cluster — depth bands inside the cluster, nodes wrapping
// into rows, barycenter-ordered so dependencies sit under their users.
// Clusters then pack left-to-right, largest first, so unrelated islands
// (a collab and its helpers vs. a lone skin mod) never interleave;
// single-node components gather into a compact strip at the end.
const BAND_MAX_WIDTH = 1700;
const SLOT_GAP_X = 14;
const ROW_GAP_Y = 16;
const BAND_GAP = 72;
const CLUSTER_GAP_X = 110;
const CLUSTER_GAP_Y = 140;
const SINGLETON_GAP_X = 24;
const PACK_MAX_WIDTH = 3200;

type NodePos = { x: number; y: number; width: number; height: number };

function layoutPositions(
  index: ModIndex,
  visible: Set<string>,
  dependencySet: Set<string>,
): Map<string, NodePos> {
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

  // Connected components over the undirected edge union.
  const componentOf = new Map<string, number>();
  const components: string[][] = [];
  for (const start of visible) {
    if (componentOf.has(start)) continue;
    const id = components.length;
    const nodes: string[] = [];
    const queue = [start];
    componentOf.set(start, id);
    while (queue.length > 0) {
      const current = queue.pop()!;
      nodes.push(current);
      for (const neighbor of [
        ...(depsOf.get(current) ?? []),
        ...(dependentsOf.get(current) ?? []),
      ]) {
        if (!componentOf.has(neighbor)) {
          componentOf.set(neighbor, id);
          queue.push(neighbor);
        }
      }
    }
    components.push(nodes);
  }

  // depth 0 = no dependents (top of its cluster). Longest path over
  // reverse edges, memoized; cycles (shouldn't exist) break to 0.
  // Edges never cross components, so global depth = per-cluster depth.
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

  // Lay out each component into a local (0,0)-anchored box.
  type Cluster = {
    positions: Map<string, NodePos>;
    width: number;
    height: number;
    size: number;
  };
  const clusters: Cluster[] = components.map((nodes) => {
    const bands: string[][] = [];
    for (const fileName of nodes) {
      (bands[depths.get(fileName) ?? 0] ??= []).push(fileName);
    }
    const positions = new Map<string, NodePos>();
    let bandY = 0;
    let clusterWidth = 0;
    for (const band of bands) {
      if (!band) continue;
      const rowHeight =
        Math.max(...band.map((f) => nodeHeight(dependencySet.has(f)))) +
        ROW_GAP_Y;
      // Barycenter of already-placed dependents; nodes without placed
      // dependents (top band) keep alphabetical order.
      const keyed = band.map((fileName) => {
        const anchors = [...(dependentsOf.get(fileName) ?? [])]
          .map((d) => positions.get(d))
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

      let x = 0;
      let row = 0;
      for (const { fileName } of keyed) {
        const isDependency = dependencySet.has(fileName);
        const width = nodeWidth(displayName(fileName), isDependency);
        if (x + width > BAND_MAX_WIDTH && x > 0) {
          x = 0;
          row += 1;
        }
        positions.set(fileName, {
          x,
          y: bandY + row * rowHeight,
          width,
          height: nodeHeight(isDependency),
        });
        clusterWidth = Math.max(clusterWidth, x + width);
        x += width + SLOT_GAP_X;
      }
      bandY += (row + 1) * rowHeight + BAND_GAP;
    }
    return {
      positions,
      width: clusterWidth,
      height: Math.max(0, bandY - BAND_GAP),
      size: nodes.length,
    };
  });

  // Pack clusters into rows, largest first. Singletons sort last and
  // flow tightly, forming a compact strip of unconnected mods.
  clusters.sort((a, b) => b.size - a.size || b.width - a.width);
  const out = new Map<string, NodePos>();
  let cursorX = 24;
  let cursorY = 24;
  let packedRowHeight = 0;
  for (const cluster of clusters) {
    if (cursorX > 24 && cursorX + cluster.width > PACK_MAX_WIDTH) {
      cursorX = 24;
      cursorY += packedRowHeight + CLUSTER_GAP_Y;
      packedRowHeight = 0;
    }
    for (const [fileName, pos] of cluster.positions) {
      out.set(fileName, { ...pos, x: pos.x + cursorX, y: pos.y + cursorY });
    }
    cursorX +=
      cluster.width + (cluster.size === 1 ? SINGLETON_GAP_X : CLUSTER_GAP_X);
    packedRowHeight = Math.max(packedRowHeight, cluster.height);
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

  const positions = layoutPositions(index, visible, dependencySet);

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
        height: pos.height,
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
  const { setCenter, getZoom, fitView } = useReactFlow();

  // Refit when the visible set changes shape (filter switch, folder
  // change) — the initial fitView only covers mount.
  const lastFitKey = useRef("");
  useEffect(() => {
    const key = `${filter}:${positions.size}`;
    if (lastFitKey.current === key) return;
    const isFirst = lastFitKey.current === "";
    lastFitKey.current = key;
    if (isFirst) return; // mount is handled by the fitView prop
    requestAnimationFrame(() => {
      void fitView({ padding: 0.1, maxZoom: 1, duration: 300 });
    });
  }, [filter, positions.size, fitView]);
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
    setCenter(pos.x + pos.width / 2, pos.y + pos.height / 2, {
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
