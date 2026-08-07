import { z } from "zod";
import { invoke } from "../contract";
import { GlobalConfigSchema } from "../../schemas/config";

export const configContract = {
  read: invoke("config:read", z.void(), GlobalConfigSchema),
  write: invoke(
    "config:write",
    z.object({ config: GlobalConfigSchema }),
    z.void(),
  ),
} as const;
