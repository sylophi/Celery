import path from "node:path";
import { stat } from "node:fs/promises";
import type { Handlers } from "@shared/ipc/types";
import { remoteContract } from "@shared/ipc/modules/remote";
import { PSEUDO_MODS } from "@shared/graph";
import type {
  InstallStep,
  RemoteFileStatus,
  RemoteProgress,
} from "@shared/schemas";
import type { HandlerContext } from "../register";
import { broadcastAll } from "../register";
import { readGlobalConfig } from "../../lib/config";
import { scanModsFolder } from "../../lib/mods/scan";
import {
  categories,
  depGraph,
  modInfo as fetchModInfo,
  updateDb,
} from "../../lib/remote/db";
import {
  fetchVerified,
  installFileName,
  placeInMods,
} from "../../lib/remote/install";

async function scanConfigured() {
  const config = await readGlobalConfig();
  if (!config.modsFolder) return null;
  return scanModsFolder(config.modsFolder);
}

// Progress broadcasts are throttled per download so a fast local
// mirror doesn't flood the IPC channel.
function progressReporter(id: string) {
  let lastSent = 0;
  return (receivedBytes: number, totalBytes: number) => {
    const now = Date.now();
    if (now - lastSent < 150 && receivedBytes !== totalBytes) return;
    lastSent = now;
    send({ id, phase: "downloading", receivedBytes, totalBytes });
  };
}

function send(payload: RemoteProgress): void {
  broadcastAll(remoteContract, "progress", payload);
}

export const remoteHandlers: Handlers<typeof remoteContract, HandlerContext> = {
  overview: async () => {
    const [snapshot, db, cats] = await Promise.all([
      scanConfigured(),
      updateDb(),
      categories(),
    ]);
    if (!snapshot || !db) {
      return { available: false, fetchedAt: null, byFile: {} };
    }
    const byFile: Record<string, RemoteFileStatus> = {};
    for (const file of snapshot.files) {
      // A zip can declare several entries; the first one the database
      // knows is the identity GameBanana tracks it under.
      const entry = file.entries.find((e) => db.has(e.name));
      if (!entry) continue;
      const dbEntry = db.get(entry.name)!;
      byFile[file.fileName] = {
        name: entry.name,
        gameBananaId: dbEntry.GameBananaId,
        gameBananaType: dbEntry.GameBananaType,
        ...(cats?.[entry.name] !== undefined
          ? { category: cats[entry.name]! }
          : {}),
        latestVersion: dbEntry.Version,
        latestSizeBytes: dbEntry.Size,
        // Everest's semantics: the local file's hash not being one the
        // database has seen for this mod means a newer (or at least
        // different) build exists upstream.
        updateAvailable:
          file.xxHash !== undefined && !dbEntry.xxHash.includes(file.xxHash),
      };
    }
    return { available: true, fetchedAt: Date.now(), byFile };
  },

  modInfo: async ({ name }) => {
    const db = await updateDb();
    const entry = db?.get(name);
    if (!entry) return null;
    return fetchModInfo(entry.GameBananaType, entry.GameBananaId);
  },

  resolveMissing: async ({ names }) => {
    const [snapshot, db, graph] = await Promise.all([
      scanConfigured(),
      updateDb(),
      depGraph(),
    ]);
    const installed = new Set<string>();
    for (const file of snapshot?.files ?? []) {
      for (const entry of file.entries) installed.add(entry.name);
    }
    const steps: InstallStep[] = [];
    const seen = new Set<string>();
    const queue = [...names];
    while (queue.length > 0) {
      const name = queue.shift()!;
      if (seen.has(name) || installed.has(name) || PSEUDO_MODS.has(name)) {
        continue;
      }
      seen.add(name);
      const entry = db?.get(name);
      steps.push({
        name,
        installable: entry !== undefined,
        ...(entry
          ? {
              version: entry.Version,
              sizeBytes: entry.Size,
              gameBananaId: entry.GameBananaId,
            }
          : {}),
      });
      // Walk the remote dependency graph so deps-of-deps that are also
      // missing locally land in the same plan.
      for (const dep of graph?.get(name) ?? []) {
        queue.push(dep.name);
      }
    }
    return { steps };
  },

  install: async ({ names }) => {
    const config = await readGlobalConfig();
    if (!config.modsFolder) throw new Error("No Mods folder configured");
    const folder = config.modsFolder;
    const db = await updateDb();
    if (!db) throw new Error("Update database unavailable");
    const installed: string[] = [];
    const failed: { name: string; error: string }[] = [];
    // Sequential on purpose: one download at a time is kind to the
    // mirror and keeps progress reporting legible.
    for (const name of names) {
      const entry = db.get(name);
      if (!entry) {
        failed.push({ name, error: "not in the update database" });
        continue;
      }
      try {
        // oxlint-disable-next-line no-await-in-loop
        const verified = await fetchVerified(
          name,
          entry,
          progressReporter(name),
        );
        let fileName = installFileName(name);
        // If a zip by that name already exists it is NOT this mod
        // (the mod is missing), so pick a fresh name, never overwrite.
        // oxlint-disable-next-line no-await-in-loop
        const exists = await stat(path.join(folder, fileName)).then(
          () => true,
          () => false,
        );
        if (exists) {
          fileName = installFileName(`${name}-${entry.GameBananaFileId}`);
        }
        send({ id: name, phase: "verifying", receivedBytes: 0, totalBytes: 0 });
        // oxlint-disable-next-line no-await-in-loop
        await placeInMods(verified, folder, fileName);
        send({ id: name, phase: "done", receivedBytes: 0, totalBytes: 0 });
        installed.push(name);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({
          id: name,
          phase: "error",
          receivedBytes: 0,
          totalBytes: 0,
          error: message,
        });
        failed.push({ name, error: message });
      }
    }
    return { installed, failed };
  },

  update: async ({ fileName }) => {
    const config = await readGlobalConfig();
    if (!config.modsFolder) throw new Error("No Mods folder configured");
    const snapshot = await scanModsFolder(config.modsFolder);
    const file = snapshot.files.find((f) => f.fileName === fileName);
    if (!file) throw new Error(`Unknown mod file: ${fileName}`);
    const db = await updateDb();
    if (!db) throw new Error("Update database unavailable");
    const entry = file.entries.find((e) => db.has(e.name));
    if (!entry) throw new Error(`${fileName} is not in the update database`);
    const dbEntry = db.get(entry.name)!;
    try {
      const verified = await fetchVerified(
        entry.name,
        dbEntry,
        progressReporter(entry.name),
      );
      send({
        id: entry.name,
        phase: "verifying",
        receivedBytes: 0,
        totalBytes: 0,
      });
      // Same fileName: blacklist.txt and favorites.txt keep working
      // without a rewrite, exactly like Everest's in-game updater.
      await placeInMods(verified, config.modsFolder, fileName);
      send({ id: entry.name, phase: "done", receivedBytes: 0, totalBytes: 0 });
    } catch (error) {
      send({
        id: entry.name,
        phase: "error",
        receivedBytes: 0,
        totalBytes: 0,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};
