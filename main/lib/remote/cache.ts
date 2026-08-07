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

async function touchMeta(key: string, meta: CacheMeta): Promise<void> {
  await writeFile(
    `${cachePath(key)}.meta.json`,
    JSON.stringify({ ...meta, fetchedAt: Date.now() }),
    "utf8",
  );
}

async function readBody(key: string): Promise<Buffer | null> {
  try {
    return await readFile(cachePath(key));
  } catch {
    return null;
  }
}

// Fetch `url`, caching the body on disk under `key`. Within `ttlMs` the
// cached copy is returned without network I/O. Past the TTL the server
// is revalidated; on any network failure a stale copy is still
// returned. Returns null only when there is no cached copy and the
// fetch failed; callers treat that as "remote unavailable".
export async function fetchCached(
  key: string,
  url: string,
  ttlMs: number,
): Promise<Buffer | null> {
  const meta = await readMeta(key);
  if (meta && Date.now() - meta.fetchedAt < ttlMs) {
    const body = await readBody(key);
    if (body) return body;
  }
  const headers: Record<string, string> = {};
  if (meta?.etag) headers["If-None-Match"] = meta.etag;
  if (meta?.lastModified) headers["If-Modified-Since"] = meta.lastModified;
  try {
    const response = await fetch(url, { headers });
    if (response.status === 304 && meta) {
      const body = await readBody(key);
      if (body) {
        await touchMeta(key, meta);
        return body;
      }
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    await writeEntry(key, body, {
      fetchedAt: Date.now(),
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
    return readBody(key);
  }
}
