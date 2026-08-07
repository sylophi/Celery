import { z } from "zod";
import { invoke } from "../contract";
import { ModsSnapshotSchema } from "../../schemas/mods";

export const modsContract = {
  // Scans the configured Mods folder (manifest reads are cached by file
  // size+mtime, so rescans are cheap). Returns the full snapshot.
  scan: invoke("mods:scan", z.void(), ModsSnapshotSchema),
  // Applies a batch of enabled-state changes in one blacklist.txt write
  // (cascades arrive as one batch) and returns the fresh snapshot.
  setEnabled: invoke(
    "mods:setEnabled",
    z.object({
      changes: z.array(z.object({ fileName: z.string(), enabled: z.boolean() })),
    }),
    ModsSnapshotSchema,
  ),
  setFavorite: invoke(
    "mods:setFavorite",
    z.object({ fileName: z.string(), favorite: z.boolean() }),
    ModsSnapshotSchema,
  ),
} as const;
