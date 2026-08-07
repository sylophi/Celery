import path from "node:path";
import { readFile, rename, writeFile } from "node:fs/promises";

// Everest's txt-file state, treated as the single source of truth so
// celery, Olympus, and the in-game menu stay interchangeable.
//
// blacklist.txt semantics (inverted, matching the in-game generator):
// every mod file is listed; DISABLED mods are plain lines, ENABLED mods
// are commented out with "# ". A file absent from the list is enabled —
// Everest only skips what it reads uncommented.

const BLACKLIST = "blacklist.txt";
const FAVORITES = "favorites.txt";

const BLACKLIST_HEADER = [
  "# This is the blacklist. Lines starting with # are ignored.",
  '# File generated through the "Toggle Mods" menu in Mod Options',
  "",
];
const FAVORITES_HEADER = ["# This is the favorite list. Lines starting with # are ignored.", ""];

// Uncommented, non-blank lines — the only thing Everest itself reads.
function activeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

async function readLinesOrEmpty(filePath: string): Promise<string[]> {
  try {
    return activeLines(await readFile(filePath, "utf8"));
  } catch {
    return [];
  }
}

// Everest (C#) writes CRLF on Windows, where the game usually runs;
// keep whatever style the existing file uses so rewrites stay
// byte-faithful outside the toggled lines.
async function detectEol(filePath: string): Promise<"\r\n" | "\n"> {
  try {
    const text = await readFile(filePath, "utf8");
    return text.includes("\r\n") ? "\r\n" : "\n";
  } catch {
    return "\n";
  }
}

async function writeAtomic(filePath: string, lines: string[]): Promise<void> {
  const eol = await detectEol(filePath);
  const content = lines.join(eol) + eol;
  const tmp = `${filePath}.tmp`;
  try {
    await writeFile(tmp, content, "utf8");
    await rename(tmp, filePath);
  } catch (error) {
    // A read-only *directory* forbids creating the tmp file even when
    // the txt file itself is writable. Fall back to an in-place write —
    // Everest writes these files directly too.
    if ((error as NodeJS.ErrnoException).code !== "EACCES") throw error;
    await writeFile(filePath, content, "utf8");
  }
}

export async function readDisabledSet(folder: string): Promise<Set<string>> {
  return new Set(await readLinesOrEmpty(path.join(folder, BLACKLIST)));
}

// Rewrites the full blacklist in Everest's own shape: every file listed,
// case-insensitively sorted, enabled ones commented out.
export async function writeBlacklist(
  folder: string,
  files: { fileName: string; enabled: boolean }[],
): Promise<void> {
  const sorted = files.toSorted((a, b) =>
    a.fileName.toLowerCase().localeCompare(b.fileName.toLowerCase()),
  );
  const lines = [
    ...BLACKLIST_HEADER,
    ...sorted.map((f) => (f.enabled ? `# ${f.fileName}` : f.fileName)),
  ];
  await writeAtomic(path.join(folder, BLACKLIST), lines);
}

export async function readFavorites(folder: string): Promise<Set<string>> {
  return new Set(await readLinesOrEmpty(path.join(folder, FAVORITES)));
}

// Favorites are append-ordered in the wild; preserve existing order and
// append newly-starred mods at the end, like the in-game menu does.
export async function writeFavorite(
  folder: string,
  fileName: string,
  favorite: boolean,
): Promise<void> {
  const filePath = path.join(folder, FAVORITES);
  const existing = await readLinesOrEmpty(filePath);
  const without = existing.filter((line) => line !== fileName);
  const lines = favorite ? [...without, fileName] : without;
  await writeAtomic(filePath, [...FAVORITES_HEADER, ...lines]);
}
