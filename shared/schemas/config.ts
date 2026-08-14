import { z } from "zod";

export const ThemeSchema = z.enum(["light", "dark", "system"]);
export type Theme = z.infer<typeof ThemeSchema>;

export const GlobalConfigSchema = z.object({
  modsFolder: z.string().optional(),
  theme: ThemeSchema.optional(),
  // When true, dependency cascades show a confirmation dialog before
  // writing. Off by default: toggles apply immediately and the status
  // pill reports what the cascade did.
  confirmCascades: z.boolean().optional(),
});
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
