import { shell } from "electron";
import type { Handlers } from "@shared/ipc/types";
import { shellContract } from "@shared/ipc/modules/shell";
import type { HandlerContext } from "../register";

export const shellHandlers: Handlers<typeof shellContract, HandlerContext> = {
  showItemInFolder: ({ path }) => {
    shell.showItemInFolder(path);
  },
  openExternal: async ({ url }) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error(`Refusing to open non-web URL: ${url}`);
    }
    await shell.openExternal(url);
  },
};
