import type { Handlers } from "@shared/ipc/types";
import { folderStateContract } from "@shared/ipc/modules/folderState";
import type { HandlerContext } from "../register";
import { readFolderState, writeFolderState } from "../../lib/folderState";

export const folderStateHandlers: Handlers<typeof folderStateContract, HandlerContext> = {
  read: ({ folder }) => readFolderState(folder),
  write: ({ folder, state }) => writeFolderState(folder, state),
};
