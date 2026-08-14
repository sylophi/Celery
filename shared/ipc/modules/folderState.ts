import { z } from "zod";
import { invoke } from "../contract";
import { FolderStateSchema } from "../../schemas/folderState";

// Per-folder app state (section overrides), keyed by Mods
// folder path so a second install keeps separate intents. Whole-object
// save keeps the contract trivial; the state is tiny.
export const folderStateContract = {
  read: invoke(
    "folderState:read",
    z.object({ folder: z.string() }),
    FolderStateSchema,
  ),
  write: invoke(
    "folderState:write",
    z.object({ folder: z.string(), state: FolderStateSchema }),
    z.void(),
  ),
} as const;
