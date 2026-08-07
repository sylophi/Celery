import path from "node:path";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { hashFile } from "../mods/hash";
import { celeryRoot } from "../util/paths";
import { mirrorUrl, type UpdateEntry } from "./db";

// Downloads a mod zip named in the update database and places it in
// the Mods folder. Every byte is verified (size + XXH64 against the
// database) before anything touches the Mods folder, and placement
// goes through a temp file in the target directory so a crash can
// never leave a half-written zip where Everest would load it.

export type ProgressFn = (receivedBytes: number, totalBytes: number) => void;

async function downloadTo(
  url: string,
  dest: string,
  onProgress: ProgressFn,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}`);
  }
  const total = Number(response.headers.get("content-length") ?? 0);
  let received = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      onProgress(received, total);
      controller.enqueue(chunk);
    },
  });
  // Electron's DOM-typed ReadableStream and Node's stream/web type are
  // structurally the same stream; the cast only bridges the lib types.
  await pipeline(
    Readable.fromWeb(
      response.body.pipeThrough(counter) as unknown as NodeReadableStream,
    ),
    createWriteStream(dest),
  );
}

// Fetch the entry's zip into the downloads scratch dir and verify it.
// GameBanana first, banana-mirror on failure. Returns the temp path.
export async function fetchVerified(
  name: string,
  entry: UpdateEntry,
  onProgress: ProgressFn,
): Promise<string> {
  const dir = path.join(celeryRoot(), "downloads");
  await mkdir(dir, { recursive: true });
  // Scratch name derives from the db file id, never from the mod name.
  const part = path.join(dir, `${entry.GameBananaFileId}.zip.part`);
  try {
    await downloadTo(entry.URL, part, onProgress);
  } catch {
    await downloadTo(mirrorUrl(entry), part, onProgress);
  }
  const info = await stat(part);
  if (info.size !== entry.Size) {
    await rm(part, { force: true });
    throw new Error(
      `${name}: size mismatch (got ${info.size}, expected ${entry.Size})`,
    );
  }
  const hash = await hashFile(part);
  if (!entry.xxHash.includes(hash)) {
    await rm(part, { force: true });
    throw new Error(`${name}: checksum mismatch`);
  }
  return part;
}

// Move a verified download into the Mods folder as `fileName`,
// overwriting any existing zip of that name. Temp-then-rename keeps
// the swap atomic; read-only-ish folders (EACCES/EPERM on rename) fall
// back to a direct overwrite copy.
export async function placeInMods(
  verifiedPath: string,
  modsFolder: string,
  fileName: string,
): Promise<void> {
  const target = path.join(modsFolder, fileName);
  const tmp = `${target}.celery-tmp`;
  try {
    await copyFile(verifiedPath, tmp);
    await rename(tmp, target);
  } catch (error) {
    await rm(tmp, { force: true });
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EACCES" && code !== "EPERM") throw error;
    await copyFile(verifiedPath, target);
  } finally {
    await rm(verifiedPath, { force: true });
  }
}

// Filename for a fresh install: the mod Name with filesystem-hostile
// characters flattened, matching how Everest names its own downloads.
export function installFileName(name: string): string {
  const safe = name.replaceAll(/[\\/:*?"<>|]/g, "_").trim();
  return `${safe || "mod"}.zip`;
}
