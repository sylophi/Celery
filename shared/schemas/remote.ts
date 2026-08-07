import { z } from "zod";

// Data derived from maddie480's Everest update database, the same
// backend Olympus and the in-game updater use. Everything here is
// best-effort: the app must stay fully usable when offline, so remote
// lookups degrade to "unknown" rather than erroring.

// Per installed file: how it maps onto GameBanana and whether the
// database has a newer build than the local zip (Everest semantics:
// the local hash is absent from the database entry's hash list).
export const RemoteFileStatusSchema = z.object({
  // The everest.yaml Name that matched the update database (a zip can
  // declare several entries; the first one present in the db wins).
  name: z.string(),
  gameBananaId: z.number(),
  gameBananaType: z.string(),
  category: z.string().optional(),
  latestVersion: z.string(),
  latestSizeBytes: z.number(),
  updateAvailable: z.boolean(),
});
export type RemoteFileStatus = z.infer<typeof RemoteFileStatusSchema>;

export const RemoteOverviewSchema = z.object({
  // False when the database could not be fetched and no cached copy
  // exists; the UI should show nothing remote rather than zeros.
  available: z.boolean(),
  fetchedAt: z.number().nullable(),
  byFile: z.record(z.string(), RemoteFileStatusSchema),
});
export type RemoteOverview = z.infer<typeof RemoteOverviewSchema>;

// Rich per-mod metadata from the gamebanana-info endpoint.
export const RemoteModInfoSchema = z.object({
  title: z.string(),
  author: z.string(),
  pageUrl: z.string(),
  category: z.string().optional(),
  description: z.string(),
  // Mirrored screenshots (celestemodupdater.0x0a.de) load reliably and
  // spare GameBanana's CDN; originals kept as fallback.
  screenshots: z.array(
    z.object({ mirror: z.string().optional(), original: z.string() }),
  ),
  downloads: z.number(),
  likes: z.number(),
  views: z.number(),
  createdDate: z.number(),
  updatedDate: z.number(),
});
export type RemoteModInfo = z.infer<typeof RemoteModInfoSchema>;

// One step of a missing-dependency install plan. Transitive: a missing
// dep's own missing deps (per the remote dependency graph) are
// included as separate steps.
export const InstallStepSchema = z.object({
  name: z.string(),
  installable: z.boolean(),
  version: z.string().optional(),
  sizeBytes: z.number().optional(),
  gameBananaId: z.number().optional(),
});
export type InstallStep = z.infer<typeof InstallStepSchema>;

export const InstallPlanSchema = z.object({
  steps: z.array(InstallStepSchema),
});
export type InstallPlan = z.infer<typeof InstallPlanSchema>;

export const InstallResultSchema = z.object({
  installed: z.array(z.string()),
  failed: z.array(z.object({ name: z.string(), error: z.string() })),
});
export type InstallResult = z.infer<typeof InstallResultSchema>;

// Download progress broadcast while installs/updates run. `id` is the
// mod Name being fetched; total is 0 when the server sent no length.
export const RemoteProgressSchema = z.object({
  id: z.string(),
  phase: z.enum(["downloading", "verifying", "done", "error"]),
  receivedBytes: z.number(),
  totalBytes: z.number(),
  error: z.string().optional(),
});
export type RemoteProgress = z.infer<typeof RemoteProgressSchema>;
