import path from "node:path";
import { readFile, rename, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import type { z } from "zod";
import { celeryRoot } from "./util/paths";

// Small JSON-file store with atomic writes (tmp + rename). All app
// state lives in a handful of files under the celery root.

export async function readJsonFile<S extends z.ZodTypeAny>(
  name: string,
  schema: S,
  fallback: z.output<S>,
): Promise<z.output<S>> {
  try {
    const raw = await readFile(path.join(celeryRoot(), name), "utf8");
    return schema.parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export function readJsonFileSync<S extends z.ZodTypeAny>(
  name: string,
  schema: S,
  fallback: z.output<S>,
): z.output<S> {
  try {
    const raw = readFileSync(path.join(celeryRoot(), name), "utf8");
    return schema.parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

// Strict variant for read-modify-write flows: only a missing file reads
// as the fallback. Corrupt JSON or a schema mismatch throws — degrading
// to the fallback there would make the subsequent write silently
// discard everything else the file held.
export async function readJsonFileStrict<S extends z.ZodTypeAny>(
  name: string,
  schema: S,
  fallback: z.output<S>,
): Promise<z.output<S>> {
  let raw: string;
  try {
    raw = await readFile(path.join(celeryRoot(), name), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
  return schema.parse(JSON.parse(raw));
}

export async function writeJsonFile(
  name: string,
  value: unknown,
): Promise<void> {
  const target = path.join(celeryRoot(), name);
  const tmp = `${target}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, target);
}
