// Positions for the graph view. Two layouts, because the two questions
// the view answers want different pictures.
//
// OVERVIEW (nothing selected) answers "what have I got installed". A
// Celeste mods folder is a shallow, extremely dense bipartite graph: a
// handful of collabs each pull in 20-90 helpers out of a pool most of
// them share. Drawing those edges all at once is a solid grey fan that
// says nothing, so the overview encodes structure with PLACEMENT and
// draws only the edges that stay inside one island. Helpers pulled in
// by several mods move to a shared shelf and carry a use count instead
// of a bundle of lines.
//
// FOCUS (a mod selected) answers "what does this need, what needs it".
// There the edges are the whole point and there are few enough of them
// to draw, so the neighborhood is relaid out on its own: dependents
// above, the mod in the middle, dependencies below.
import type { ModIndex } from "@shared/graph";
import { displayName } from "@/lib/utils";
import { nodeHeight, nodeWidth } from "./ModNode";

// Missing dependencies appear as ghost nodes. Their ids live in the
// same string space as fileNames, namespaced by this prefix.
export const GHOST_PREFIX = "missing:";
export const isGhostId = (id: string): boolean => id.startsWith(GHOST_PREFIX);
export const ghostName = (id: string): string => id.slice(GHOST_PREFIX.length);

const SLOT_GAP_X = 10;
const ROW_GAP_Y = 8;
const BAND_GAP = 34;
const ISLAND_PAD = 12;
const ISLAND_GAP = 22;
const REGION_PAD = 22;
const REGION_HEADER = 34;
const REGION_GAP_Y = 40;
const ORIGIN = 24;
// Above this many neighbours on one level, the selection's fan out to
// them is drawn as nothing but a haze, so it is left out.
const FAN_LIMIT = 24;

export type Region = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  note: string;
  variant: "region" | "island";
};

export type Bounds = { x: number; y: number; width: number; height: number };
// A placed node is just a box, same as any other.
export type NodePos = Bounds;

export type Layout = {
  positions: Map<string, NodePos>;
  // Extent of everything placed, nodes and region panels alike. The view
  // frames the graph from this rather than measuring the rendered DOM.
  bounds: Bounds;
  // Everything the layout placed, i.e. exactly what the view renders.
  nodes: Set<string>;
  regions: Region[];
  // Whether an edge between two placed nodes is worth drawing. Each
  // layout answers for itself, because what counts as signal differs:
  // see the rules at each return site.
  drawEdge: (from: string, to: string) => boolean;
  // Shared helpers -> how many top-level mods pull them in. Stands in
  // for the edges the overview does not draw.
  usedBy: Map<string, number>;
};

const byName = (a: string, b: string) =>
  a.toLowerCase().localeCompare(b.toLowerCase());

const modCount = (n: number) => `${n} ${n === 1 ? "mod" : "mods"}`;

function boundsOf(positions: Map<string, NodePos>, regions: Region[]): Bounds {
  const boxes = [...positions.values(), ...regions];
  if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

type Dims = (id: string) => { width: number; height: number };

function makeDims(
  dependencySet: Set<string>,
  usedBy?: Map<string, number>,
): Dims {
  return (id) => {
    if (isGhostId(id)) {
      return {
        width: nodeWidth(ghostName(id), true),
        height: nodeHeight(true),
      };
    }
    const isDependency = dependencySet.has(id);
    const badge = (usedBy?.get(id) ?? 0) > 1;
    return {
      width: nodeWidth(displayName(id), isDependency, badge),
      height: nodeHeight(isDependency),
    };
  };
}

type Row = { items: string[]; width: number; height: number };

function packRows(items: string[], dims: Dims, wrapWidth: number): Row[] {
  const rows: Row[] = [];
  let row: Row = { items: [], width: 0, height: 0 };
  for (const id of items) {
    const d = dims(id);
    const grown =
      row.items.length === 0 ? d.width : row.width + SLOT_GAP_X + d.width;
    if (row.items.length > 0 && grown > wrapWidth) {
      rows.push(row);
      row = { items: [], width: 0, height: 0 };
    }
    row.width =
      row.items.length === 0 ? d.width : row.width + SLOT_GAP_X + d.width;
    row.height = Math.max(row.height, d.height);
    row.items.push(id);
  }
  if (row.items.length > 0) rows.push(row);
  return rows;
}

// Places rows into `positions` and returns the block's extent. Rows are
// centered when `center` is set (used by the focus bands, where a fan of
// dependencies should sit under the node it belongs to).
function placeRows(
  positions: Map<string, NodePos>,
  rows: Row[],
  dims: Dims,
  startX: number,
  startY: number,
  center: number | null,
): { width: number; bottom: number } {
  let y = startY;
  let width = 0;
  for (const row of rows) {
    let x = center === null ? startX : center - row.width / 2;
    for (const id of row.items) {
      const d = dims(id);
      // Mixed heights in one row (a card next to pills) center on the
      // row's baseline rather than hanging off its top.
      positions.set(id, { x, y: y + (row.height - d.height) / 2, ...d });
      x += d.width + SLOT_GAP_X;
    }
    width = Math.max(width, row.width);
    y += row.height + ROW_GAP_Y;
  }
  return { width, bottom: rows.length > 0 ? y - ROW_GAP_Y : startY };
}

// Hard dependency edges restricted to `nodes`, plus edges into ghosts.
// Structure follows hard edges only: an optional reference must not pull
// a whole subtree into one mod's island (StrawberryJam is not "part of"
// BreezeContest because a Breeze sub-mod optionally uses it).
type Wiring = {
  depsOf: Map<string, Set<string>>;
  dependentsOf: Map<string, Set<string>>;
  ghosts: Set<string>;
};

function wire(
  index: ModIndex,
  nodes: Set<string>,
  ghostDeps: Map<string, string[]>,
): Wiring {
  const depsOf = new Map<string, Set<string>>();
  const dependentsOf = new Map<string, Set<string>>();
  const ghosts = new Set<string>();
  for (const fileName of nodes) {
    const deps = new Set<string>();
    for (const to of index.hardDeps.get(fileName) ?? []) {
      if (nodes.has(to)) deps.add(to);
    }
    for (const ghost of ghostDeps.get(fileName) ?? []) {
      deps.add(ghost);
      ghosts.add(ghost);
    }
    depsOf.set(fileName, deps);
    for (const to of deps) {
      let set = dependentsOf.get(to);
      if (!set) dependentsOf.set(to, (set = new Set()));
      set.add(fileName);
    }
  }
  for (const ghost of ghosts) depsOf.set(ghost, new Set());
  return { depsOf, dependentsOf, ghosts };
}

// Depth below the top of the graph: 0 = nothing depends on it. Longest
// path over reverse edges, memoized; cycles (shouldn't exist) break to 0.
function depths(nodes: Iterable<string>, wiring: Wiring): Map<string, number> {
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const hit = memo.get(id);
    if (hit !== undefined) return hit;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let depth = 0;
    for (const dependent of wiring.dependentsOf.get(id) ?? []) {
      depth = Math.max(depth, depthOf(dependent) + 1);
    }
    visiting.delete(id);
    memo.set(id, depth);
    return depth;
  };
  for (const id of nodes) depthOf(id);
  return memo;
}

export function layoutOverview(
  index: ModIndex,
  visible: Set<string>,
  dependencySet: Set<string>,
  ghostDeps: Map<string, string[]>,
  // Width/height of the pane this has to fit into. The layout aims for
  // the same proportions so the fit can zoom in as far as possible
  // instead of leaving a band of empty canvas down one side.
  aspect: number,
): Layout {
  const wiring = wire(index, visible, ghostDeps);
  const all = [...visible, ...wiring.ghosts];
  const depthOf = depths(all, wiring);

  // Top-level mods: the things you actually play or run. Everything else
  // is infrastructure some mod pulled in.
  const roots = [...visible]
    .filter((f) => (wiring.dependentsOf.get(f)?.size ?? 0) === 0)
    .toSorted(byName);

  // Which top-level mods reach each dependency.
  const reachedBy = new Map<string, Set<string>>();
  for (const root of roots) {
    const stack = [root];
    const seen = new Set([root]);
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const dep of wiring.depsOf.get(current) ?? []) {
        if (seen.has(dep)) continue;
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
  const usedBy = new Map<string, number>();
  for (const id of all) {
    if ((wiring.dependentsOf.get(id)?.size ?? 0) === 0) continue; // a root
    const owners = reachedBy.get(id);
    if (owners !== undefined && owners.size === 1) {
      const owner = [...owners][0]!;
      let list = exclusiveOf.get(owner);
      if (!list) exclusiveOf.set(owner, (list = []));
      list.push(id);
    } else {
      shared.push(id);
      usedBy.set(id, owners?.size ?? 0);
    }
  }

  const dims = makeDims(dependencySet, usedBy);

  // Total node area sets the target width, so the whole picture lands
  // near the aspect ratio of a window instead of a tall ribbon.
  const area = all.reduce((sum, id) => {
    const d = dims(id);
    return sum + (d.width + SLOT_GAP_X) * (d.height + ROW_GAP_Y);
  }, 0);
  // Packing wastes a bit under half the area, so a target width of
  // sqrt(area * aspect / efficiency) lands the finished box near the
  // requested proportions.
  const targetWidth = Math.max(
    900,
    Math.round(Math.sqrt((area * aspect) / 0.48)),
  );

  const positions = new Map<string, NodePos>();
  const regions: Region[] = [];
  const islandOf = new Map<string, string>();

  // --- one island per top-level mod that owns dependencies ---
  type Island = {
    root: string;
    positions: Map<string, NodePos>;
    width: number;
    height: number;
    count: number;
  };
  const islands: Island[] = [];
  const bare: string[] = [];
  for (const root of roots) {
    const exclusive = exclusiveOf.get(root) ?? [];
    if (exclusive.length === 0) {
      bare.push(root);
      continue;
    }
    const local = new Map<string, NodePos>();
    const rootDims = dims(root);
    // Wrap wide enough to keep an island squarish: a 40-child island
    // shouldn't be a 40-row column or a single 40-wide strip.
    const wrapWidth = Math.max(
      rootDims.width,
      Math.min(660, Math.ceil(Math.sqrt(exclusive.length)) * 175),
    );
    local.set(root, { x: 0, y: 0, ...rootDims });
    const bands: string[][] = [];
    for (const id of exclusive) (bands[depthOf.get(id) ?? 0] ??= []).push(id);
    let y = rootDims.height + 14;
    let width = rootDims.width;
    for (const band of bands) {
      if (!band) continue;
      const box = placeRows(
        local,
        packRows(band.toSorted(byName), dims, wrapWidth),
        dims,
        0,
        y,
        null,
      );
      width = Math.max(width, box.width);
      y = box.bottom + ROW_GAP_Y;
    }
    for (const id of local.keys()) islandOf.set(id, root);
    islands.push({
      root,
      positions: local,
      width: width + ISLAND_PAD * 2,
      height: y - ROW_GAP_Y + ISLAND_PAD * 2,
      count: local.size,
    });
  }

  // Islands vary wildly in size (a 40-helper collab next to a two-node
  // map pack), so rows would leave a tall dead column beside the biggest
  // one. Skyline packing instead: biggest first, each island dropped into
  // the lowest spot it fits, which tucks the small ones into the gaps.
  islands.sort(
    (a, b) => b.height * b.width - a.height * a.width || b.count - a.count,
  );
  const modsWrap = Math.max(targetWidth, ...islands.map((i) => i.width));
  const skyline: { x: number; width: number; y: number }[] = [
    { x: 0, width: modsWrap, y: 0 },
  ];
  const topOf = (x: number, width: number): number => {
    let top = 0;
    for (const segment of skyline) {
      if (segment.x + segment.width <= x || segment.x >= x + width) continue;
      top = Math.max(top, segment.y);
    }
    return top;
  };
  let modsWidth = 0;
  let modsBottom = 0;
  for (const island of islands) {
    // Candidate positions are the left edges of skyline segments: the
    // lowest landing spot always starts at one of them.
    let best = { x: 0, y: Infinity };
    for (const segment of skyline) {
      const x = segment.x;
      if (x + island.width > modsWrap) continue;
      const y = topOf(x, island.width);
      if (y < best.y) best = { x, y };
    }
    const { x, y } =
      best.y === Infinity ? { x: 0, y: topOf(0, modsWrap) } : best;
    regions.push({
      id: `island:${island.root}`,
      x,
      y,
      width: island.width,
      height: island.height,
      title: "",
      note: "",
      variant: "island",
    });
    for (const [id, pos] of island.positions) {
      positions.set(id, {
        ...pos,
        x: pos.x + x + ISLAND_PAD,
        y: pos.y + y + ISLAND_PAD,
      });
    }
    modsWidth = Math.max(modsWidth, x + island.width);
    modsBottom = Math.max(modsBottom, y + island.height);
    // Raise the skyline over the footprint just taken.
    const right = x + island.width + ISLAND_GAP;
    const top = y + island.height + ISLAND_GAP;
    const next: typeof skyline = [];
    for (const segment of skyline) {
      const left = Math.max(segment.x, x);
      const cut = Math.min(segment.x + segment.width, right);
      if (cut <= left) {
        next.push(segment);
        continue;
      }
      if (segment.x < left) {
        next.push({ x: segment.x, width: left - segment.x, y: segment.y });
      }
      if (cut < segment.x + segment.width) {
        next.push({
          x: cut,
          width: segment.x + segment.width - cut,
          y: segment.y,
        });
      }
    }
    next.push({ x, width: island.width + ISLAND_GAP, y: top });
    next.sort((a, b) => a.x - b.x);
    skyline.length = 0;
    skyline.push(...next);
  }

  // Mods that pull in nothing of their own trail the islands as plain
  // cards; they need no frame because they contain nothing.
  let y = modsBottom;
  if (bare.length > 0) {
    const startY = islands.length > 0 ? modsBottom + ISLAND_GAP : 0;
    const box = placeRows(
      positions,
      packRows(bare, dims, modsWrap),
      dims,
      0,
      startY,
      null,
    );
    modsWidth = Math.max(modsWidth, box.width);
    y = box.bottom;
  }

  // Wrap everything placed so far in the "mods" region.
  const modsHeight = y;
  for (const [id, pos] of positions) {
    positions.set(id, {
      ...pos,
      x: pos.x + ORIGIN + REGION_PAD,
      y: pos.y + ORIGIN + REGION_HEADER,
    });
  }
  for (const region of regions) {
    region.x += ORIGIN + REGION_PAD;
    region.y += ORIGIN + REGION_HEADER;
  }
  const modsRegion: Region = {
    id: "region:mods",
    x: ORIGIN,
    y: ORIGIN,
    width: modsWidth + REGION_PAD * 2,
    height: modsHeight + REGION_HEADER + REGION_PAD,
    title: "mods",
    note: `${roots.length} top-level, with what only they use`,
    variant: "region",
  };

  // --- shared shelf: helpers more than one mod pulls in ---
  const sharedRegions: Region[] = [];
  if (shared.length > 0) {
    const ordered = shared.toSorted(
      (a, b) => (usedBy.get(b) ?? 0) - (usedBy.get(a) ?? 0) || byName(a, b),
    );
    const top = modsRegion.y + modsRegion.height + REGION_GAP_Y;
    const wrap = Math.max(targetWidth, modsRegion.width - REGION_PAD * 2);
    const box = placeRows(
      positions,
      packRows(ordered, dims, wrap),
      dims,
      ORIGIN + REGION_PAD,
      top + REGION_HEADER,
      null,
    );
    sharedRegions.push({
      id: "region:shared",
      x: ORIGIN,
      y: top,
      width: Math.max(box.width + REGION_PAD * 2, modsRegion.width),
      height: box.bottom - top + REGION_PAD,
      title: "shared",
      note: `${shared.length} helpers more than one mod needs`,
      variant: "region",
    });
  }

  const allRegions = [modsRegion, ...sharedRegions, ...regions];
  return {
    positions,
    bounds: boundsOf(positions, allRegions),
    nodes: new Set(positions.keys()),
    regions: allRegions,
    // Only edges that stay inside one island: short, local, and never
    // crossing. The long ones up to the shared shelf are the hairball,
    // and the shelf's use counts say the same thing without the ink.
    drawEdge: (from, to) => {
      const island = islandOf.get(from);
      return island !== undefined && island === islandOf.get(to);
    },
    usedBy,
  };
}

export function layoutFocus(
  index: ModIndex,
  selectedId: string,
  base: Set<string>,
  dependencySet: Set<string>,
  ghostDeps: Map<string, string[]>,
  aspect: number,
): Layout {
  const dims = makeDims(dependencySet);
  const wiring = wire(index, base, ghostDeps);

  // Signed levels around the selection: negative above (things that need
  // it), positive below (things it needs). A node keeps the level it is
  // first reached at, so the shortest path decides where it sits.
  const level = new Map<string, number>([[selectedId, 0]]);
  const spread = (edges: Map<string, Set<string>>, sign: 1 | -1) => {
    let frontier = [selectedId];
    let step = 0;
    while (frontier.length > 0) {
      step += 1;
      const next: string[] = [];
      for (const current of frontier) {
        for (const neighbor of edges.get(current) ?? []) {
          if (level.has(neighbor)) continue;
          level.set(neighbor, sign * step);
          next.push(neighbor);
        }
      }
      frontier = next;
    }
  };
  spread(wiring.depsOf, 1);
  spread(wiring.dependentsOf, -1);

  // Optional links get one hop, and only off the selection itself:
  // drawn any deeper they add crosshatch, not information.
  for (const to of index.optionalDeps.get(selectedId) ?? []) {
    if (base.has(to) && !level.has(to)) level.set(to, 1);
  }
  for (const from of index.optionalDependents.get(selectedId) ?? []) {
    if (base.has(from) && !level.has(from)) level.set(from, -1);
  }
  // Missing deps need no special handling: `wire` hangs them off the
  // node that declares them, so the downward spread picks up exactly the
  // ones on this selection's own dependency paths. (A dependent's
  // missing deps are its business, not this view's.)

  const bands = new Map<number, string[]>();
  for (const [id, value] of level) {
    let band = bands.get(value);
    if (!band) bands.set(value, (band = []));
    band.push(id);
  }
  const levels = [...bands.keys()].toSorted((a, b) => a - b);
  // Levels too crowded for the selection's own fan to read as lines.
  const hazy = new Set(
    levels.filter((v) => (bands.get(v)?.length ?? 0) > FAN_LIMIT),
  );

  // The bands are stacked, so their combined area decides how wide the
  // whole thing should be to match the pane; the widest single band sets
  // the floor so no band is forced into an absurd number of rows.
  const bandArea = [...bands.values()].reduce(
    (sum, band) =>
      sum +
      band.reduce((row, id) => {
        const d = dims(id);
        return row + (d.width + SLOT_GAP_X) * (d.height + ROW_GAP_Y);
      }, 0),
    0,
  );
  const wrap = Math.max(
    420,
    Math.min(2000, Math.round(Math.sqrt((bandArea * aspect) / 0.62))),
  );
  const center = ORIGIN + wrap / 2;

  const positions = new Map<string, NodePos>();
  const rows = new Map<
    number,
    { top: number; bottom: number; width: number }
  >();
  let y = ORIGIN;
  for (const value of levels) {
    const band = bands.get(value)!.toSorted(byName);
    const box = placeRows(
      positions,
      packRows(band, dims, wrap),
      dims,
      ORIGIN,
      y,
      center,
    );
    rows.set(value, { top: y, bottom: box.bottom, width: box.width });
    y = box.bottom + BAND_GAP;
  }

  // Frame the two halves so the direction of the arrows is readable
  // without following one.
  const regions: Region[] = [];
  const frame = (
    id: string,
    title: string,
    note: string,
    span: number[],
  ): void => {
    const bounds = span.map((v) => rows.get(v)).filter((b) => b !== undefined);
    if (bounds.length === 0) return;
    const top = Math.min(...bounds.map((b) => b.top));
    const bottom = Math.max(...bounds.map((b) => b.bottom));
    // Hug the widest row actually placed rather than the wrap budget,
    // which a short band never uses up.
    const width = Math.max(...bounds.map((b) => b.width)) + REGION_PAD * 2;
    regions.push({
      id,
      x: center - width / 2,
      y: top - REGION_HEADER,
      width,
      height: bottom - top + REGION_HEADER + REGION_PAD,
      title,
      note,
      variant: "region",
    });
  };
  const above = levels.filter((v) => v < 0);
  const below = levels.filter((v) => v > 0);
  const count = (values: number[]) =>
    values.reduce((sum, v) => sum + (bands.get(v)?.length ?? 0), 0);
  frame("region:dependents", "needed by", modCount(count(above)), above);
  frame("region:deps", "needs", modCount(count(below)), below);

  return {
    positions,
    bounds: boundsOf(positions, regions),
    nodes: new Set(level.keys()),
    regions,
    // Anything touching the selection, plus the steps that carry an
    // outer node in towards it. Two exceptions, both cases where the
    // line repeats what the picture already says:
    //
    // Edges BETWEEN two nodes on the same level (both already connect to
    // the middle) are what turn a 22-dependent fan back into a thicket.
    //
    // And past FAN_LIMIT neighbours the fan itself stops being readable:
    // 90 lines converging on one node are a grey haze, while sitting
    // inside the "needs" panel already means "the selection needs this".
    drawEdge: (from, to) => {
      const a = level.get(from);
      const b = level.get(to);
      if (a === undefined || b === undefined) return false;
      if (from === selectedId || to === selectedId) {
        return !hazy.has(from === selectedId ? b : a);
      }
      return Math.sign(a) === Math.sign(b) && Math.abs(a - b) === 1;
    },
    usedBy: new Map(),
  };
}
