import { z } from "zod";
import { EMPTY_FOLDER_STATE, FolderStateSchema, type FolderState } from "@shared/schemas";
import { readJsonFile, writeJsonFile } from "./store";

const STATE_FILE = "folder-state.json";
const FileSchema = z.object({
  byFolder: z.record(z.string(), FolderStateSchema),
});
const EMPTY: z.output<typeof FileSchema> = { byFolder: {} };

export async function readFolderState(folder: string): Promise<FolderState> {
  const data = await readJsonFile(STATE_FILE, FileSchema, EMPTY);
  return data.byFolder[folder] ?? EMPTY_FOLDER_STATE;
}

export async function writeFolderState(folder: string, state: FolderState): Promise<void> {
  const data = await readJsonFile(STATE_FILE, FileSchema, EMPTY);
  await writeJsonFile(STATE_FILE, {
    byFolder: { ...data.byFolder, [folder]: state },
  });
}
