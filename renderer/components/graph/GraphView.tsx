import { useEffect, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Edge,
} from "@xyflow/react";
import type { ModIndex } from "@shared/graph";
import type { GraphFilter } from "@/App";
import { GhostNode, type GhostFlowNode } from "./GhostNode";
import { ModNode, type ModFlowNode } from "./ModNode";
import { RegionNode, type RegionFlowNode } from "./RegionNode";
import {
  GHOST_PREFIX,
  ghostName,
  isGhostId,
  layoutFocus,
  layoutOverview,
} from "./layout";

// What the graph has to keep clear of: the minimap in the bottom-left
// corner, and the `w-72` detail panel down the right whenever something
// is selected. Clearing the minimap's height also clears its width, so
// no left gutter is reserved for it.
const EDGE_PAD = 20;
const MINIMAP_CLEARANCE = 116;
const PANEL_INSET = 312;

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 1.5;
// The overview is dense enough that natural size is already the right
// size; a focus view holds few nodes, so it may zoom right in.
const OVERVIEW_MAX_ZOOM = 1.2;

// Cheap identity for a node set: enough to tell one rendered graph from
// the next without rebuilding a full id list on every store update.
const stamp = (list: { id: string }[]) =>
  `${list.length}:${list[0]?.id ?? ""}:${list.at(-1)?.id ?? ""}`;

const nodeTypes = {
  mod: ModNode,
  ghost: GhostNode,
  region: RegionNode,
};
type AnyFlowNode = ModFlowNode | GhostFlowNode | RegionFlowNode;

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
  // The enabled filter narrows what exists as far as the graph is
  // concerned. The orphans filter is a way of FINDING orphans, so it
  // only trims the overview: focusing one still shows its real context
  // (usually a pile of disabled dependents, which is the explanation).
  const inScope = new Set(
    (filter === "enabled"
      ? index.files.filter((f) => f.enabled)
      : index.files
    ).map((f) => f.fileName),
  );
  const overviewSet =
    filter === "orphans"
      ? new Set([...inScope].filter((f) => orphans.has(f)))
      : inScope;

  // Missing dependencies become ghost nodes, keyed by the missing Name
  // (several mods missing the same dep share one).
  const ghostDeps = new Map<string, string[]>();
  const ghostDependents = new Map<string, string[]>();
  for (const fileName of inScope) {
    for (const name of new Set(index.missing.get(fileName) ?? [])) {
      const id = GHOST_PREFIX + name;
      let deps = ghostDeps.get(fileName);
      if (!deps) ghostDeps.set(fileName, (deps = []));
      deps.push(id);
      let dependents = ghostDependents.get(id);
      if (!dependents) ghostDependents.set(id, (dependents = []));
      dependents.push(fileName);
    }
  }

  // A selection the current scope dropped (a disabled mod picked in the
  // sidebar while the enabled filter is on) still gets focused; it is
  // what the user asked to look at.
  const focused =
    selectedId !== null && (inScope.has(selectedId) || isGhostId(selectedId))
      ? selectedId
      : null;

  // One scalar per selector: returning an object here would build a new
  // reference every render, which the store reads as a change and spins.
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);
  // Aim the layout at the shape of the area the fit will actually use
  // (the detail panel covers the right of it in focus mode), so it
  // neither leaves a dead band down one side nor overshoots.
  const usableWidth = Math.max(
    320,
    paneWidth - EDGE_PAD - (focused ? PANEL_INSET : EDGE_PAD),
  );
  const usableHeight = Math.max(240, paneHeight - EDGE_PAD - MINIMAP_CLEARANCE);
  const aspect = paneHeight > 0 ? usableWidth / usableHeight : 1.6;

  const layout = focused
    ? layoutFocus(
        index,
        focused,
        new Set([...inScope, focused]),
        dependencySet,
        ghostDeps,
        aspect,
      )
    : layoutOverview(
        index,
        overviewSet,
        dependencySet,
        ghostDeps,
        aspect,
        filter === "orphans" ? "orphans" : "mods",
      );
  const { positions, bounds, nodes: drawn, regions, drawEdge, usedBy } = layout;

  const nodes: AnyFlowNode[] = (() => {
    const out: AnyFlowNode[] = [];
    // Regions first and at the bottom of the stack: they are backdrop.
    for (const region of regions) {
      out.push({
        id: region.id,
        type: "region",
        position: { x: region.x, y: region.y },
        width: region.width,
        height: region.height,
        draggable: false,
        selectable: false,
        zIndex: 0,
        data: {
          title: region.title,
          note: region.note,
          variant: region.variant,
        },
      });
    }
    for (const file of index.files) {
      const pos = positions.get(file.fileName);
      if (!pos || !drawn.has(file.fileName)) continue;
      out.push({
        id: file.fileName,
        type: "mod",
        position: { x: pos.x, y: pos.y },
        width: pos.width,
        height: pos.height,
        selected: file.fileName === selectedId,
        zIndex: 1,
        data: {
          file,
          orphan: orphans.has(file.fileName),
          missing: index.missing.get(file.fileName)?.length ?? 0,
          hasDependents: dependencySet.has(file.fileName),
          usedBy: usedBy.get(file.fileName),
        },
      });
    }
    for (const [id, dependents] of ghostDependents) {
      const pos = positions.get(id);
      if (!pos || !drawn.has(id)) continue;
      out.push({
        id,
        type: "ghost",
        position: { x: pos.x, y: pos.y },
        width: pos.width,
        height: pos.height,
        selected: id === selectedId,
        zIndex: 1,
        data: { name: ghostName(id), neededBy: dependents.length },
      });
    }
    return out;
  })();

  const edges: Edge[] = (() => {
    const out: Edge[] = [];
    const push = (from: string, to: string, kind: string) => {
      if (!drawn.has(from) || !drawn.has(to)) return;
      if (!drawEdge(from, to)) return;
      const active = focused !== null && (from === focused || to === focused);
      out.push({
        id: `${kind}:${from}->${to}`,
        source: from,
        target: to,
        className: [kind !== "h" && `edge-${kind}`, active && "edge-active"]
          .filter(Boolean)
          .join(" "),
        markerEnd: active
          ? { type: MarkerType.ArrowClosed, width: 14, height: 14 }
          : undefined,
      });
    };
    for (const [from, deps] of index.hardDeps) {
      for (const to of deps) push(from, to, "h");
    }
    // Optional edges only ever hang off the selection; drawn everywhere
    // they add crosshatch, not information.
    if (focused) {
      for (const [from, deps] of index.optionalDeps) {
        for (const to of deps) {
          if (from === focused || to === focused) push(from, to, "optional");
        }
      }
    }
    // A missing dependency is a problem worth the ink wherever it shows.
    for (const [ghost, dependents] of ghostDependents) {
      for (const from of dependents) push(from, ghost, "missing");
    }
    return out;
  })();

  // Refit whenever the picture changes shape: switching filters, and
  // above all entering or leaving focus, which relays everything out.
  //
  // The viewport is computed here rather than handed to fitView, which
  // measures the node bounds in React Flow's store: that store is filled
  // by a child effect one commit AFTER this render, so fitView would
  // frame the PREVIOUS graph. The layout already knows its own extent,
  // so use it and skip the round trip.
  const { setViewport } = useReactFlow();
  const lastFitKey = useRef("");
  useEffect(() => {
    // Before the pane has been measured there is nothing to fit into.
    if (paneWidth === 0 || paneHeight === 0) return;
    if (bounds.width <= 0 || bounds.height <= 0) return;
    // The pane size belongs in the key too, so resizing the window (or
    // dragging the sidebar) reframes instead of leaving the graph
    // stranded off to one side.
    const key = `${filter}:${focused ?? ""}:${stamp(nodes)}:${Math.round(usableWidth)}x${Math.round(usableHeight)}`;
    if (lastFitKey.current === key) return;
    const first = lastFitKey.current === "";
    lastFitKey.current = key;

    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(
        usableWidth / bounds.width,
        usableHeight / bounds.height,
        focused ? MAX_ZOOM : OVERVIEW_MAX_ZOOM,
      ),
    );
    void setViewport(
      {
        zoom,
        x: EDGE_PAD + (usableWidth - bounds.width * zoom) / 2 - bounds.x * zoom,
        y:
          EDGE_PAD +
          (usableHeight - bounds.height * zoom) / 2 -
          bounds.y * zoom,
      },
      // The first frame has nothing to animate away from.
      { duration: first ? 0 : 320 },
    );
  }, [
    filter,
    focused,
    nodes,
    bounds,
    paneWidth,
    paneHeight,
    usableWidth,
    usableHeight,
    setViewport,
  ]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_event, node) =>
        node.type === "region" ? onSelect(null) : onSelect(node.id)
      }
      onPaneClick={() => onSelect(null)}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      panOnScroll
      zoomOnPinch
      proOptions={{ hideAttribution: true }}
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
