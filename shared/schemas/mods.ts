import { z } from "zod";

// A single dependency reference inside an everest.yaml entry. Versions
// are minimums, not pins, and are not strict semver (2-, 3- and 4-part
// forms all occur in the wild), so they stay opaque strings here.
export const DependencyRefSchema = z.object({
  name: z.string(),
  version: z.string(),
});
export type DependencyRef = z.infer<typeof DependencyRefSchema>;

// One mod entry from an everest.yaml. A single zip may declare several
// (e.g. a collab plus its map-specific code mods).
export const ModEntrySchema = z.object({
  name: z.string(),
  version: z.string(),
  dll: z.string().optional(),
  dependencies: z.array(DependencyRefSchema),
  optionalDependencies: z.array(DependencyRefSchema),
});
export type ModEntry = z.infer<typeof ModEntrySchema>;

// Structural tags derived from zip contents: local metadata carries no
// categories, but the archive layout reveals what a mod is.
export const StructuralTagSchema = z.enum([
  "helper", // has a DLL, ships no maps: a code library
  "map-pack", // ships Maps/*.bin
  "collab", // has CollabUtils2CollabID.txt
  "skin", // has SkinModHelperConfig.yaml
  "audio", // ships Audio/ banks and little else
  "asset-pack", // no DLL, no maps: graphics/decals/dialog only
]);
export type StructuralTag = z.infer<typeof StructuralTagSchema>;

// One archive in the Mods folder, the unit Everest's txt files operate
// on. `fileName` (e.g. "FrostHelper.zip") is the identity everywhere;
// mod Names map onto files via their entries.
export const ModFileSchema = z.object({
  fileName: z.string(),
  sizeBytes: z.number(),
  mtimeMs: z.number(),
  enabled: z.boolean(),
  favorite: z.boolean(),
  entries: z.array(ModEntrySchema),
  tags: z.array(StructuralTagSchema),
  // XXH64 of the whole zip, lowercase hex: the identity Everest's
  // update database tracks. Absent when hashing failed (locked file).
  xxHash: z.string().optional(),
  // Set when the archive had no parseable manifest; such files still
  // show up (Everest loads them) but contribute no graph edges.
  parseError: z.string().optional(),
});
export type ModFile = z.infer<typeof ModFileSchema>;

export const ModsSnapshotSchema = z.object({
  folder: z.string(),
  files: z.array(ModFileSchema),
});
export type ModsSnapshot = z.infer<typeof ModsSnapshotSchema>;
