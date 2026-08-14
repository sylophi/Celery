import { z } from "zod";

// Which view a mod belongs in: "mod" (top-level, the things you play)
// or "dependency" (the infrastructure they pull in). The default comes
// from the graph (hard dependents > 0 → dependency); an override pins a
// mod to the other side, e.g. a tool that is only referenced
// optionally, or a helper the user plays directly.
export const SectionSchema = z.enum(["mod", "dependency"]);
export type Section = z.infer<typeof SectionSchema>;

// Groups (stored intent: "these mods belong to an activity") had their
// UI removed. The field stays so existing folder state round-trips
// instead of being silently dropped on the next write.
const RetiredGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(z.string()),
});

// Celery's own per-Mods-folder state (Everest has no such concepts).
export const FolderStateSchema = z.object({
  groups: z.array(RetiredGroupSchema).default([]),
  sectionOverrides: z.record(z.string(), SectionSchema).default({}),
});
export type FolderState = z.infer<typeof FolderStateSchema>;

export const EMPTY_FOLDER_STATE: FolderState = {
  groups: [],
  sectionOverrides: {},
};
