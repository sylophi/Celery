import { z } from "zod";

export const UpdaterStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("idle") }),
  z.object({ kind: z.literal("checking") }),
  z.object({ kind: z.literal("downloading") }),
  // `version` is absent when the platform didn't report one.
  z.object({ kind: z.literal("ready"), version: z.string().optional() }),
  // Dev builds and the portable Windows zip (no Squirrel install).
  z.object({ kind: z.literal("unsupported") }),
  z.object({ kind: z.literal("error"), message: z.string() }),
]);
export type UpdaterState = z.infer<typeof UpdaterStateSchema>;
