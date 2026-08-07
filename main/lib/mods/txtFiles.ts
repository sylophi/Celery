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
const FAVORITES_HEADER = [
  "# This is the favorite list. Lines starting with # are ignored.",
  "",
];
const HEADER_PREFIXES = ["# This is the blacklist", "# File generated through"];

// Uncommented, non-blank lines — the only thing Everest itself reads.
function activeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

// ENOENT means "no state yet" and reads as empty. Anything else — a
// locked file, a permissions hiccup — must fail the operation loudly:
// treating it as empty would let a later full-file rewrite wipe the
// user's real state.
async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

// Everest (C#) writes CRLF on Windows, where the game usually runs;
// keep whatever style the existing file uses.
function eolOf(raw: string | null): "\r\n" | "\n" {
  return raw?.includes("\r\n") ? "\r\n" : "\n";
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tmp = `${filePath}.tmp`;
  try {
    await writeFile(tmp, content, "utf8");
    await rename(tmp, filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // EACCES: a read-only directory forbids creating the tmp file even
    // when the txt file itself is writable. EPERM: Windows refusing to
    // rename over a file the running game holds open. Both fall back to
    // an in-place write — Everest writes these files directly too.
    if (code !== "EACCES" && code !== "EPERM") throw error;
    await writeFile(filePath, content, "utf8");
  }
}

export async function readDisabledSet(folder: string): Promise<Set<string>> {
  const raw = await readFileOrNull(path.join(folder, BLACKLIST));
  return new Set(activeLines(raw ?? ""));
}

// Rewrites the blacklist by merging over the existing file: entries the
// scanner doesn't model (folder-form mods, symlinks, stray names) keep
// their current state instead of being dropped from the list. Output is
// Everest's own shape: every file listed, case-insensitively sorted,
// enabled ones commented out.
export async function writeBlacklist(
  folder: string,
  files: { fileName: string; enabled: boolean }[],
): Promise<void> {
  const filePath = path.join(folder, BLACKLIST);
  const raw = await readFileOrNull(filePath);
  const entries = new Map<string, boolean>();
  for (const line of (raw ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (HEADER_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) continue;
    if (trimmed.startsWith("#")) {
      entries.set(trimmed.replace(/^#+\s*/, ""), true);
    } else {
      entries.set(trimmed, false);
    }
  }
  for (const file of files) entries.set(file.fileName, file.enabled);

  const lines = [
    ...BLACKLIST_HEADER,
    ...[...entries]
      .toSorted((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()))
      .map(([name, enabled]) => (enabled ? `# ${name}` : name)),
  ];
  const eol = eolOf(raw);
  await writeAtomic(filePath, lines.join(eol) + eol);
}

export async function readFavorites(folder: string): Promise<Set<string>> {
  const raw = await readFileOrNull(path.join(folder, FAVORITES));
  return new Set(activeLines(raw ?? ""));
}

// Favorites are append-ordered in the wild; preserve existing order and
// append newly-starred mods at the end, like the in-game menu does.
export async function writeFavorite(
  folder: string,
  fileName: string,
  favorite: boolean,
): Promise<void> {
  const filePath = path.join(folder, FAVORITES);
  const raw = await readFileOrNull(filePath);
  const existing = activeLines(raw ?? "");
  const without = existing.filter((line) => line !== fileName);
  const lines = favorite ? [...without, fileName] : without;
  const eol = eolOf(raw);
  await writeAtomic(filePath, [...FAVORITES_HEADER, ...lines].join(eol) + eol);
}
