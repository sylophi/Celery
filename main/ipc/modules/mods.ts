import type { Handlers } from "@shared/ipc/types";
import { modsContract } from "@shared/ipc/modules/mods";
import type { HandlerContext } from "../register";
import { readGlobalConfig } from "../../lib/config";
import { scanModsFolder } from "../../lib/mods/scan";
import { writeBlacklist, writeFavorite } from "../../lib/mods/txtFiles";

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
};
