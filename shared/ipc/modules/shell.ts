import { z } from "zod";
import { invoke } from "../contract";

export const shellContract = {
  showItemInFolder: invoke("shell:showItemInFolder", z.object({ path: z.string() }), z.void()),
  openExternal: invoke("shell:openExternal", z.object({ url: z.string() }), z.void()),
} as const;
