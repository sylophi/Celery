import path from "node:path";
import { shell } from "electron";
import type { Handlers } from "@shared/ipc/types";
import { modsContract } from "@shared/ipc/modules/mods";
import type { HandlerContext } from "../register";
import { readGlobalConfig } from "../../lib/config";
import { scanModsFolder } from "../../lib/mods/scan";
import {
  forgetFiles,
  writeBlacklist,
  writeFavorite,
} from "../../lib/mods/txtFiles";

async function requireFolder(): Promise<string> {
  const config = await readGlobalConfig();
  if (!config.modsFolder) throw new Error("No Mods folder configured");
  return config.modsFolder;
}

async function scanOrEmpty() {
  const config = await readGlobalConfig();
  if (!config.modsFolder) return { folder: "", files: [] };
  return scanModsFolder(config.modsFolder);
}

export const modsHandlers: Handlers<typeof modsContract, HandlerContext> = {
  scan: () => scanOrEmpty(),

  setEnabled: async ({ changes }) => {
    const folder = await requireFolder();
    const snapshot = await scanModsFolder(folder);
    const enabledByFile = new Map(
      snapshot.files.map((f) => [f.fileName, f.enabled]),
    );
    for (const change of changes) {
      if (!enabledByFile.has(change.fileName)) {
        throw new Error(`Unknown mod file: ${change.fileName}`);
      }
      enabledByFile.set(change.fileName, change.enabled);
    }
    await writeBlacklist(
      folder,
      [...enabledByFile].map(([fileName, enabled]) => ({ fileName, enabled })),
    );
    // The snapshot is freshly scanned and owned by this handler;
    // mutate in place instead of re-allocating every file object.
    for (const file of snapshot.files) {
      file.enabled = enabledByFile.get(file.fileName)!;
    }
    return snapshot;
  },

  setFavorite: async ({ fileName, favorite }) => {
    const folder = await requireFolder();
    // Validate against the scan before writing: favorites.txt is
    // line-oriented, so an arbitrary renderer-supplied string (or one
    // containing a newline) must never reach it.
    const snapshot = await scanModsFolder(folder);
    if (!snapshot.files.some((f) => f.fileName === fileName)) {
      throw new Error(`Unknown mod file: ${fileName}`);
    }
    await writeFavorite(folder, fileName, favorite);
    return scanModsFolder(folder);
  },

  remove: async ({ fileNames }) => {
    const folder = await requireFolder();
    // Only names the scanner actually saw in this folder are eligible,
    // so nothing the renderer sends can be steered at a path outside it.
    const snapshot = await scanModsFolder(folder);
    const known = new Set(snapshot.files.map((f) => f.fileName));
    for (const fileName of fileNames) {
      if (!known.has(fileName))
        throw new Error(`Unknown mod file: ${fileName}`);
    }

    const trashed: string[] = [];
    const failed: { fileName: string; error: string }[] = [];
    for (const fileName of fileNames) {
      try {
        // Trash, never unlink: a mis-click has to stay recoverable, and
        // a 700MB audio pack is not something to re-download lightly.
        // oxlint-disable-next-line no-await-in-loop
        await shell.trashItem(path.join(folder, fileName));
        trashed.push(fileName);
      } catch (error) {
        failed.push({
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (trashed.length > 0) await forgetFiles(folder, trashed);
    return { trashed, failed };
  },
};
