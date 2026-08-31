import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { RemoteModInfo } from "@shared/schemas";
import { fetchCached } from "./cache";

// Typed accessors over maddie480's Celeste mod database. Sources:
//   everest_update.yaml      name -> version/hashes/download (~1.3MB)
//   mod_dependency_graph.yaml  name -> its own dependencies  (~3MB)
//   mod_ids_to_categories.json name -> GameBanana category   (~150KB)
//   gb                         name -> GameBanana page (302 redirect)
//   gamebanana-info            per-mod rich metadata (JSON)
// The server refreshes from GameBanana roughly every half hour; TTLs
// match so we never poll faster than the data can change. Parsed forms
// are memoized in-memory per cache-body identity.

const BASE = "https://maddie480.ovh/celeste";

const UPDATE_DB_TTL = 30 * 60 * 1000;
const SIDE_DB_TTL = 6 * 60 * 60 * 1000;
const INFO_TTL = 6 * 60 * 60 * 1000;
// Which GameBanana page a mod lives on almost never changes (a WiP
// resubmitted as a mod is about the only way), so this one is cached
// for a week: it is a lookup per installed mod, and a stale answer
// costs at most a few days of the old page.
const PAGE_TTL = 7 * 24 * 60 * 60 * 1000;

export const UpdateEntrySchema = z.object({
  Version: z.coerce.string(),
  LastUpdate: z.number(),
  Size: z.number(),
  // Digits only: this reaches a filesystem path for the partial
  // download as well as a URL, so nothing path-shaped may get through.
  GameBananaFileId: z.coerce.string().regex(/^\d+$/),
  xxHash: z.array(z.string()),
  URL: z.string(),
});
export type UpdateEntry = z.infer<typeof UpdateEntrySchema>;

export function mirrorUrl(entry: UpdateEntry): string {
  return `https://celestemodupdater.0x0a.de/banana-mirror/${entry.GameBananaFileId}.zip`;
}

type Memo<T> = { body: Buffer; value: T } | null;

let updateDbMemo: Memo<Map<string, UpdateEntry>> = null;

export async function updateDb(): Promise<Map<string, UpdateEntry> | null> {
  const body = await fetchCached(
    "everest_update.yaml",
    `${BASE}/everest_update.yaml`,
    UPDATE_DB_TTL,
  );
  if (!body) return null;
  if (updateDbMemo && updateDbMemo.body === body) return updateDbMemo.value;
  const raw: unknown = parseYaml(body.toString("utf8"));
  const map = new Map<string, UpdateEntry>();
  if (typeof raw === "object" && raw !== null) {
    for (const [name, value] of Object.entries(raw)) {
      const parsed = UpdateEntrySchema.safeParse(value);
      // Individual malformed entries are skipped, not fatal: one odd
      // mod upstream must not take out update checking for everything.
      if (parsed.success) map.set(name, parsed.data);
    }
  }
  updateDbMemo = { body, value: map };
  return map;
}

let categoriesMemo: Memo<Record<string, string>> = null;

export async function categories(): Promise<Record<string, string> | null> {
  const body = await fetchCached(
    "mod_ids_to_categories.json",
    `${BASE}/mod_ids_to_categories.json`,
    SIDE_DB_TTL,
  );
  if (!body) return null;
  if (categoriesMemo && categoriesMemo.body === body) {
    return categoriesMemo.value;
  }
  const parsed = z
    .record(z.string(), z.string())
    .safeParse(JSON.parse(body.toString("utf8")));
  const value = parsed.success ? parsed.data : {};
  categoriesMemo = { body, value };
  return value;
}

const DepGraphEntrySchema = z.object({
  Dependencies: z
    .array(z.object({ Name: z.string(), Version: z.coerce.string() }))
    .default([]),
});
export type RemoteDeps = { name: string; version: string }[];

let depGraphMemo: Memo<Map<string, RemoteDeps>> = null;

// The full GameBanana dependency graph, used to make missing-dep
// installs transitive (a missing dep's own deps may be missing too).
export async function depGraph(): Promise<Map<string, RemoteDeps> | null> {
  const body = await fetchCached(
    "mod_dependency_graph.yaml",
    `${BASE}/mod_dependency_graph.yaml`,
    SIDE_DB_TTL,
  );
  if (!body) return null;
  if (depGraphMemo && depGraphMemo.body === body) return depGraphMemo.value;
  const raw: unknown = parseYaml(body.toString("utf8"));
  const map = new Map<string, RemoteDeps>();
  if (typeof raw === "object" && raw !== null) {
    for (const [name, value] of Object.entries(raw)) {
      const parsed = DepGraphEntrySchema.safeParse(value);
      if (!parsed.success) continue;
      map.set(
        name,
        parsed.data.Dependencies.map((d) => ({
          name: d.Name,
          version: d.Version,
        })),
      );
    }
  }
  depGraphMemo = { body, value: map };
  return map;
}

const InfoResponseSchema = z.object({
  Name: z.string(),
  Author: z.string().default(""),
  PageURL: z.string(),
  CategoryName: z.string().optional(),
  Description: z.string().default(""),
  Screenshots: z.array(z.string()).default([]),
  MirroredScreenshots: z.array(z.string()).default([]),
  Downloads: z.number().default(0),
  Likes: z.number().default(0),
  Views: z.number().default(0),
  CreatedDate: z.number().default(0),
  UpdatedDate: z.number().default(0),
});

// GameBanana's own page sections, as they appear in a page URL, mapped
// to the item type the info endpoint names them by.
const PAGE_TYPES: Record<string, string> = {
  mods: "Mod",
  tools: "Tool",
  wips: "Wip",
};

const PAGE_URL = /^https:\/\/gamebanana\.com\/([a-z]+)\/(\d+)$/;

export type ModPage = { type: string; id: number };

function parsePage(url: string): ModPage | null {
  const match = PAGE_URL.exec(url);
  if (!match) return null;
  const type = PAGE_TYPES[match[1]];
  return type === undefined ? null : { type, id: Number(match[2]) };
}

// The redirect service answers with the page in a Location header and
// no body at all, so that header is the thing worth caching, but only
// once it reads as a GameBanana page. Whatever else a network can put
// in front of us (a captive portal, a proxy, an upstream that moved)
// would otherwise sit in the cache for a week, looking exactly like a
// mod that simply has no page.
async function locationHeader(response: Response): Promise<Buffer> {
  const location = response.headers.get("location");
  if (location !== null && parsePage(location)) {
    return Buffer.from(location, "utf8");
  }
  // A name the service doesn't know answers 404 with a whole HTML
  // page. Nothing here is worth keeping or reading.
  void response.body?.cancel().catch(() => {});
  if (location !== null) {
    // Every mod resolves through this one shape, so a change to it
    // empties the whole app of remote data. Say so: the last time
    // upstream moved, the only symptom was silently blank tiles.
    console.warn(`Celery: unrecognised GameBanana page redirect: ${location}`);
  }
  throw new Error(`HTTP ${response.status}`);
}

// Which GameBanana page an everest.yaml Name belongs to. The update
// database used to carry this outright. It now identifies only the
// file, so the page comes from the redirect service, whose whole job
// is turning a mod name into its page URL.
export async function modPage(name: string): Promise<ModPage | null> {
  const location = await fetchCached(
    // base64url so that a mod name, which may hold anything at all
    // including slashes and dots, can only ever name one flat file.
    `page/${Buffer.from(name, "utf8").toString("base64url")}`,
    `${BASE}/gb?id=${encodeURIComponent(name)}`,
    PAGE_TTL,
    { init: { redirect: "manual" }, bytes: locationHeader },
  );
  return location ? parsePage(location.toString("utf8")) : null;
}

export async function modInfo({
  type,
  id,
}: ModPage): Promise<RemoteModInfo | null> {
  // Belt and braces: modPage only ever yields a mapped type and a
  // digits-only id, but these reach a filesystem path as well as a
  // URL, so nothing else gets to.
  if (!/^[A-Za-z]+$/.test(type) || !Number.isInteger(id)) return null;
  const body = await fetchCached(
    `info/${type}-${id}.json`,
    `${BASE}/gamebanana-info?id=GameBanana/${type}/${id}`,
    INFO_TTL,
  );
  if (!body) return null;
  let parsed;
  try {
    parsed = InfoResponseSchema.safeParse(JSON.parse(body.toString("utf8")));
  } catch {
    return null;
  }
  if (!parsed.success) return null;
  const d = parsed.data;
  return {
    title: d.Name,
    author: d.Author,
    pageUrl: d.PageURL,
    ...(d.CategoryName !== undefined ? { category: d.CategoryName } : {}),
    description: d.Description,
    screenshots: d.Screenshots.map((original, i) => ({
      original,
      ...(d.MirroredScreenshots[i] !== undefined
        ? { mirror: d.MirroredScreenshots[i] }
        : {}),
    })),
    downloads: d.Downloads,
    likes: d.Likes,
    views: d.Views,
    createdDate: d.CreatedDate,
    updatedDate: d.UpdatedDate,
  };
}
