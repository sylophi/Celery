import { z } from "zod";
import { invoke } from "../contract";
import { ThemeSchema } from "../../schemas/config";

export const runtimeContract = {
  info: invoke(
    "runtime:info",
    z.void(),
    z.object({ version: z.string(), platform: z.string() }),
  ),
  // Persists the choice and drives nativeTheme so the vibrancy material
  // and window chrome follow the renderer.
  setTheme: invoke(
    "runtime:setTheme",
    z.object({ theme: ThemeSchema }),
    z.void(),
  ),
} as const;
