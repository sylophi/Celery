import { z } from "zod";

// A group is stored intent: "these mods belong to an activity" (e.g.
// multiplayer, skins, a collab playthrough). Toggling a group computes
// the dependency closure at apply time — nothing derived is persisted.
// Members are zip file names, the togglable unit.
export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(z.string()),
});
export type Group = z.infer<typeof GroupSchema>;

export const GroupListSchema = z.array(GroupSchema);

// Where a mod lives in the sidebar: "mod" (top-level) or "dependency".
// The default comes from the graph (hard dependents > 0 → dependency);
// an override pins a mod to the other section — e.g. a tool that is
// only referenced optionally, or a helper the user plays directly.
export const SectionSchema = z.enum(["mod", "dependency"]);
export type Section = z.infer<typeof SectionSchema>;

// Celery's own per-Mods-folder state (Everest has no such concepts).
export const FolderStateSchema = z.object({
  groups: GroupListSchema.default([]),
  sectionOverrides: z.record(z.string(), SectionSchema).default({}),
});
export type FolderState = z.infer<typeof FolderStateSchema>;

export const EMPTY_FOLDER_STATE: FolderState = {
  groups: [],
  sectionOverrides: {},
};
