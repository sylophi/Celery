import { useEffect, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import type { ModIndex } from "@shared/graph";
import { depClosure, dependentClosure } from "@shared/graph";
import type { GraphFilter } from "@/App";
import { displayName } from "@/App";
import { GhostNode, type GhostFlowNode } from "./GhostNode";
import { ModNode, nodeHeight, nodeWidth, type ModFlowNode } from "./ModNode";

const nodeTypes = { mod: ModNode, ghost: GhostNode };
type AnyFlowNode = ModFlowNode | GhostFlowNode;

// Missing dependencies appear as ghost nodes. Their ids live in the
// same string space as fileNames, namespaced by this prefix.
export const GHOST_PREFIX = "missing:";
export const isGhostId = (id: string): boolean => id.startsWith(GHOST_PREFIX);
export const ghostName = (id: string): string => id.slice(GHOST_PREFIX.length);

// Ownership layout. Connected components (hard+optional edges,
// undirected) become separate clusters. Inside each, every root mod is
// a BLOCK: the root on top with the dependencies only it reaches
// stacked beneath, while dependencies shared between roots form a
// common foundation of depth bands below all blocks — so the only
// long edges are the genuinely shared ones. Blocks order by how much
// foundation they use (heavy sharers sink next to it). Clusters pack
// largest-first; singletons form a compact strip. Missing deps join as
// dashed ghost nodes wherever their dependents put them.
const BAND_MAX_WIDTH = 1700;
const SLOT_GAP_X = 14;
const ROW_GAP_Y = 16;
const BAND_GAP = 72;
const CLUSTER_GAP_X = 110;
const CLUSTER_GAP_Y = 140;
const SINGLETON_GAP_X = 24;
const PACK_MAX_WIDTH = 3200;

type NodePos = { x: number; y: number; width: number; height: number };

const byName = (a: string, b: string) =>
  a.toLowerCase().localeCompare(b.toLowerCase());

function layoutPositions(
  index: ModIndex,
  visible: Set<string>,
  dependencySet: Set<string>,
  // fileName -> ghost ids of its missing deps. Ghosts join the layout
  // as ordinary dependency-shaped nodes: an exclusive missing dep sits
  // inside its dependent's block, a shared one in the foundation.
  ghostDeps: Map<string, string[]>,
): Map<string, NodePos> {
  // Union of hard+optional dependency edges restricted to the visible
  // set, plus the reverse map. STRUCTURE (blocks, ownership, depth
  // bands) follows hard edges only — an optional reference must not
  // swallow a whole subtree into one root's block (StrawberryJam is not
  // "part of" BreezeContest because a Breeze sub-mod optionally uses
  // it). This also makes graph roots line up with the sidebar's "mods"
  // section, which classifies by hard dependents.
  const depsOf = new Map<string, Set<string>>();
  const dependentsOf = new Map<string, Set<string>>();
  // Optional edges still count for component GROUPING, so optionally-
  // linked blocks land in the same cluster, near each other.
  const unionNeighbors = new Map<string, Set<string>>();
  const allGhosts = new Set<string>();
  for (const fileName of visible) {
    const deps = new Set<string>();
    for (const to of index.hardDeps.get(fileName) ?? []) {
      if (visible.has(to)) deps.add(to);
    }
    for (const ghost of ghostDeps.get(fileName) ?? []) {
      deps.add(ghost);
      allGhosts.add(ghost);
    }
    depsOf.set(fileName, deps);
    const neighbors = new Set<string>(deps);
    for (const to of index.optionalDeps.get(fileName) ?? []) {
      if (visible.has(to)) neighbors.add(to);
    }
    unionNeighbors.set(fileName, neighbors);
    for (const to of deps) {
      let set = dependentsOf.get(to);
      if (!set) dependentsOf.set(to, (set = new Set()));
      set.add(fileName);
    }
  }
  for (const ghost of allGhosts) depsOf.set(ghost, new Set());
  for (const [from, neighbors] of unionNeighbors) {
    for (const to of neighbors) {
      let set = unionNeighbors.get(to);
      if (!set) unionNeighbors.set(to, (set = new Set()));
      set.add(from);
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
      for (const neighbor of unionNeighbors.get(current) ?? []) {
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
  for (const ghost of allGhosts) depthOf(ghost);

  // Lay out each component into a local (0,0)-anchored box.
  //
  // Inside a component, ownership grouping: each root (nothing depends
  // on it — a collab, a map, a standalone tool) becomes a BLOCK with
  // its EXCLUSIVE dependencies (reached from that root only) stacked
  // directly beneath it, so those edges stay short and local. Only
  // dependencies shared by two or more roots go to a common foundation
  // laid out in depth bands under all the blocks — the only edges that
  // travel are the genuinely shared ones.
  type Cluster = {
    positions: Map<string, NodePos>;
    width: number;
    height: number;
    size: number;
  };

  const dims = (id: string) => {
    if (isGhostId(id)) {
      return {
        width: nodeWidth(ghostName(id), true),
        height: nodeHeight(true),
      };
    }
    const isDependency = dependencySet.has(id);
    return {
      width: nodeWidth(displayName(id), isDependency),
      height: nodeHeight(isDependency),
    };
  };
  // Flow `items` into wrapped rows anchored at (0, startY); returns the
  // bounding box. Items are placed in the given order.
  const flowRows = (
    positions: Map<string, NodePos>,
    items: string[],
    startY: number,
    wrapWidth: number,
  ): { width: number; bottom: number } => {
    let x = 0;
    let y = startY;
    let rowHeight = 0;
    let width = 0;
    for (const fileName of items) {
      const d = dims(fileName);
      if (x > 0 && x + d.width > wrapWidth) {
        x = 0;
        y += rowHeight + ROW_GAP_Y;
        rowHeight = 0;
      }
      positions.set(fileName, { x, y, width: d.width, height: d.height });
      width = Math.max(width, x + d.width);
      rowHeight = Math.max(rowHeight, d.height);
      x += d.width + SLOT_GAP_X;
    }
    return { width, bottom: items.length > 0 ? y + rowHeight : startY };
  };

  const clusters: Cluster[] = components.map((nodes) => {
    const inComponent = new Set(nodes);
    const roots = nodes
      .filter((f) => (dependentsOf.get(f)?.size ?? 0) === 0)
      .toSorted(byName);

    // Which roots reach each node (walking down dependency edges).
    const reachedBy = new Map<string, Set<string>>();
    for (const root of roots) {
      const stack = [root];
      const seen = new Set([root]);
      while (stack.length > 0) {
        const current = stack.pop()!;
        for (const dep of depsOf.get(current) ?? []) {
          if (!inComponent.has(dep) || seen.has(dep)) continue;
          seen.add(dep);
          let set = reachedBy.get(dep);
          if (!set) reachedBy.set(dep, (set = new Set()));
          set.add(root);
          stack.push(dep);
        }
      }
    }

    const exclusiveOf = new Map<string, string[]>();
    const shared: string[] = [];
    for (const fileName of nodes) {
      if ((dependentsOf.get(fileName)?.size ?? 0) === 0) continue; // root
      const owners = reachedBy.get(fileName);
      if (owners !== undefined && owners.size === 1) {
        const owner = [...owners][0]!;
        let list = exclusiveOf.get(owner);
        if (!list) exclusiveOf.set(owner, (list = []));
        list.push(fileName);
      } else {
        shared.push(fileName);
      }
    }

    // Order blocks by how much shared infrastructure each root uses:
    // light users float to the top rows, heavy sharers sink to the row
    // just above the shared foundation, keeping their many edges short.
    const sharedDegree = new Map<string, number>();
    for (const node of shared) {
      for (const owner of reachedBy.get(node) ?? []) {
        sharedDegree.set(owner, (sharedDegree.get(owner) ?? 0) + 1);
      }
    }
    const orderedRoots = roots.toSorted(
      (a, b) =>
        (sharedDegree.get(a) ?? 0) - (sharedDegree.get(b) ?? 0) || byName(a, b),
    );

    // One block per root: the root on top, its exclusive deps banded by
    // depth below, wrapped to a narrow column so the block stays tall
    // and skinny rather than smearing across the cluster.
    type Block = {
      positions: Map<string, NodePos>;
      width: number;
      height: number;
    };
    const blocks: Block[] = orderedRoots.map((root) => {
      const positions = new Map<string, NodePos>();
      const rootDims = dims(root);
      positions.set(root, { x: 0, y: 0, ...rootDims });
      const exclusive = exclusiveOf.get(root) ?? [];
      const wrapWidth = Math.max(
        rootDims.width,
        Math.min(720, Math.ceil(Math.sqrt(exclusive.length)) * 170),
      );
      const bands: string[][] = [];
      for (const fileName of exclusive) {
        (bands[depths.get(fileName) ?? 0] ??= []).push(fileName);
      }
      let y = rootDims.height + 36;
      let width = rootDims.width;
      for (const band of bands) {
        if (!band) continue;
        const box = flowRows(positions, band.toSorted(byName), y, wrapWidth);
        width = Math.max(width, box.width);
        y = box.bottom + 32;
      }
      return { positions, width, height: y - 32 };
    });

    // Blocks flow into rows; the shared foundation goes below them.
    const positions = new Map<string, NodePos>();
    const blockWrap = Math.max(BAND_MAX_WIDTH, ...blocks.map((b) => b.width));
    let bx = 0;
    let by = 0;
    let blockRowHeight = 0;
    let clusterWidth = 0;
    for (const block of blocks) {
      if (bx > 0 && bx + block.width > blockWrap) {
        bx = 0;
        by += blockRowHeight + 72;
        blockRowHeight = 0;
      }
      for (const [fileName, pos] of block.positions) {
        positions.set(fileName, { ...pos, x: pos.x + bx, y: pos.y + by });
      }
      clusterWidth = Math.max(clusterWidth, bx + block.width);
      bx += block.width + 56;
      blockRowHeight = Math.max(blockRowHeight, block.height);
    }
    let y = by + blockRowHeight + (shared.length > 0 ? 130 : 0);

    // Shared foundation: depth bands, barycenter-ordered against the
    // already-placed dependents so shared helpers drift toward their
    // heaviest users.
    const sharedBands: string[][] = [];
    for (const fileName of shared) {
      (sharedBands[depths.get(fileName) ?? 0] ??= []).push(fileName);
    }
    for (const band of sharedBands) {
      if (!band) continue;
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
        (a, b) => a.barycenter - b.barycenter || byName(a.fileName, b.fileName),
      );
      const box = flowRows(
        positions,
        keyed.map((k) => k.fileName),
        y,
        Math.max(clusterWidth, BAND_MAX_WIDTH),
      );
      clusterWidth = Math.max(clusterWidth, box.width);
      y = box.bottom + BAND_GAP;
    }

    let height = 0;
    for (const pos of positions.values()) {
      height = Math.max(height, pos.y + pos.height);
    }
    return { positions, width: clusterWidth, height, size: nodes.length };
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

  // Missing dependencies of visible mods become ghost nodes, keyed by
  // the missing Name (several mods missing the same dep share one).
  const ghostDeps = new Map<string, string[]>();
  const ghostDependents = new Map<string, string[]>();
  for (const file of index.files) {
    if (!visible.has(file.fileName)) continue;
    for (const name of new Set(index.missing.get(file.fileName) ?? [])) {
      const id = GHOST_PREFIX + name;
      let deps = ghostDeps.get(file.fileName);
      if (!deps) ghostDeps.set(file.fileName, (deps = []));
      deps.push(id);
      let dependents = ghostDependents.get(id);
      if (!dependents) ghostDependents.set(id, (dependents = []));
      dependents.push(file.fileName);
    }
  }

  const positions = layoutPositions(index, visible, dependencySet, ghostDeps);

  // The selected node's neighborhood: everything it transitively needs
  // plus everything that transitively needs it.
  // Hard closure both ways, plus one hop of optional neighbors: their
  // edges are drawn as active around the selection, so the nodes they
  // point at must not be dimmed out from under them.
  const neighborhood =
    selectedId && isGhostId(selectedId)
      ? ghostDependents.has(selectedId)
        ? new Set([selectedId, ...ghostDependents.get(selectedId)!])
        : null // ghost vanished (e.g. just installed) — no dimming
      : selectedId && visible.has(selectedId)
        ? new Set([
            ...depClosure(index, [selectedId]),
            ...dependentClosure(index, [selectedId]),
            ...(index.optionalDeps.get(selectedId) ?? []),
            ...(index.optionalDependents.get(selectedId) ?? []),
            ...(ghostDeps.get(selectedId) ?? []),
          ])
        : null;

  const nodes: AnyFlowNode[] = (() => {
    const out: AnyFlowNode[] = [];
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
    for (const [id, dependents] of ghostDependents) {
      const pos = positions.get(id);
      if (!pos) continue;
      const dimmed =
        (neighborhood && !neighborhood.has(id)) || filter === "orphans";
      out.push({
        id,
        type: "ghost",
        position: { x: pos.x, y: pos.y },
        width: pos.width,
        height: pos.height,
        selected: id === selectedId,
        style: { opacity: dimmed ? 0.25 : 1 },
        data: { name: ghostName(id), neededBy: dependents.length },
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
    // Edges into ghost nodes: dashed destructive, always drawn — a
    // missing dep is a problem worth the ink.
    for (const [ghost, dependents] of ghostDependents) {
      for (const from of dependents) {
        const active =
          selectedId !== null && (from === selectedId || ghost === selectedId);
        const dimmed =
          (neighborhood &&
            !(neighborhood.has(from) && neighborhood.has(ghost))) ||
          filter === "orphans";
        out.push({
          id: `m:${from}->${ghost}`,
          source: from,
          target: ghost,
          className: ["edge-missing", active && "edge-active"]
            .filter(Boolean)
            .join(" "),
          style: dimmed ? { opacity: 0.12 } : undefined,
          markerEnd: active
            ? { type: MarkerType.ArrowClosed, width: 14, height: 14 }
            : undefined,
        });
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
  const nodesInitialized = useNodesInitialized();
  const lastFitKey = useRef("");
  useEffect(() => {
    if (!nodesInitialized) return;
    const key = `${filter}:${positions.size}`;
    if (lastFitKey.current === key) return;
    lastFitKey.current = key;
    requestAnimationFrame(() => {
      void fitView({ padding: 0.1, maxZoom: 1, duration: 300 });
    });
  }, [nodesInitialized, filter, positions.size, fitView]);
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
