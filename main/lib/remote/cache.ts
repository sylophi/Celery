import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { celeryRoot } from "../util/paths";

// Disk-backed HTTP cache for the remote mod database. Every fetch goes
// through here so the app works offline (stale data beats no data) and
// never hammers maddie480.ovh: within the TTL the disk copy is used
// without touching the network, and revalidation sends If-None-Match /
// If-Modified-Since so unchanged files cost a 304.

const DIR = "remote-cache";

type CacheMeta = {
  fetchedAt: number;
  etag?: string;
  lastModified?: string;
};

function cachePath(key: string): string {
  return path.join(celeryRoot(), DIR, key);
}

async function readMeta(key: string): Promise<CacheMeta | null> {
  try {
    const raw = await readFile(`${cachePath(key)}.meta.json`, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as CacheMeta).fetchedAt === "number"
    ) {
      return parsed as CacheMeta;
    }
  } catch {
    // Missing or corrupt meta: treat as uncached.
  }
  return null;
}

async function writeEntry(
  key: string,
  body: Buffer,
  meta: CacheMeta,
): Promise<void> {
  const target = cachePath(key);
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await writeFile(tmp, body);
  await rename(tmp, target);
  await writeFile(`${target}.meta.json`, JSON.stringify(meta), "utf8");
}

async function touchMeta(key: string, meta: CacheMeta): Promise<number> {
  const fetchedAt = Date.now();
  await writeFile(
    `${cachePath(key)}.meta.json`,
    JSON.stringify({ ...meta, fetchedAt }),
    "utf8",
  );
  return fetchedAt;
}

// Bodies already read this process, keyed by cache key and the meta's
// fetchedAt. The point is IDENTITY: the parsed-form memos in db.ts hold
// `{ body, value }` and re-parse unless handed the same Buffer back, so
// a fresh Buffer per read silently defeated them and every caller
// re-parsed the 1.3MB update database (~480ms of blocked main thread).
const bodies = new Map<string, { fetchedAt: number; body: Buffer }>();

async function readBody(
  key: string,
  fetchedAt: number,
): Promise<Buffer | null> {
  const hit = bodies.get(key);
  if (hit && hit.fetchedAt === fetchedAt) return hit.body;
  try {
    const body = await readFile(cachePath(key));
    bodies.set(key, { fetchedAt, body });
    return body;
  } catch {
    return null;
  }
}

// Fetch `url`, caching the body on disk under `key`. Within `ttlMs` the
// cached copy is returned without network I/O. Past the TTL the server
// is revalidated; on any network failure a stale copy is still
// returned. Returns null only when there is no cached copy and the
// fetch failed; callers treat that as "remote unavailable".
export function fetchCached(
  key: string,
  url: string,
  ttlMs: number,
): Promise<Buffer | null> {
  // One read or fetch per key at a time. The grid asks for per-mod info
  // for every tile that scrolls into view, and each of those consults
  // the update database first; without this they each did their own
  // read of it.
  const pending = inFlight.get(key);
  if (pending) return pending;
  const run = fetchUncached(key, url, ttlMs).finally(() =>
    inFlight.delete(key),
  );
  inFlight.set(key, run);
  return run;
}

const inFlight = new Map<string, Promise<Buffer | null>>();

async function fetchUncached(
  key: string,
  url: string,
  ttlMs: number,
): Promise<Buffer | null> {
  const meta = await readMeta(key);
  if (meta && Date.now() - meta.fetchedAt < ttlMs) {
    const body = await readBody(key, meta.fetchedAt);
    if (body) return body;
  }
  const headers: Record<string, string> = {};
  if (meta?.etag) headers["If-None-Match"] = meta.etag;
  if (meta?.lastModified) headers["If-Modified-Since"] = meta.lastModified;
  try {
    const response = await fetch(url, { headers });
    if (response.status === 304 && meta) {
      const body = await readBody(key, meta.fetchedAt);
      if (body) {
        // Re-key the in-memory copy to the refreshed timestamp, so a
        // revalidation that changed nothing doesn't force a re-parse.
        bodies.set(key, { fetchedAt: await touchMeta(key, meta), body });
        return body;
      }
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    const fetchedAt = Date.now();
    bodies.set(key, { fetchedAt, body });
    await writeEntry(key, body, {
      fetchedAt,
      ...(response.headers.get("etag")
        ? { etag: response.headers.get("etag")! }
        : {}),
      ...(response.headers.get("last-modified")
        ? { lastModified: response.headers.get("last-modified")! }
        : {}),
    });
    return body;
  } catch {
    // Offline or server trouble: stale beats nothing.
    return readBody(key, meta?.fetchedAt ?? 0);
  }
}
