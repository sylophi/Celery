import { BrowserWindow, dialog } from "electron";
import type { Handlers } from "@shared/ipc/types";
import { dialogContract } from "@shared/ipc/modules/dialog";
import type { HandlerContext } from "../register";

export const dialogHandlers: Handlers<typeof dialogContract, HandlerContext> = {
  pickFolder: async (input, { event }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      properties: ["openDirectory"],
      title: input?.title ?? "Choose your Celeste Mods folder",
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  },
};
