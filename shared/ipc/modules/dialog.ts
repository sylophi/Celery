import { z } from "zod";
import { invoke } from "../contract";

export const dialogContract = {
  pickFolder: invoke(
    "dialog:pickFolder",
    z.object({ title: z.string().optional() }).optional(),
    z.string().nullable(),
  ),
} as const;
