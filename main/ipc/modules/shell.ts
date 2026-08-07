import nodePath from "node:path";
import { shell } from "electron";
import type { Handlers } from "@shared/ipc/types";
import { shellContract } from "@shared/ipc/modules/shell";
import type { HandlerContext } from "../register";

export const shellHandlers: Handlers<typeof shellContract, HandlerContext> = {
  showItemInFolder: ({ path }) => {
    // Renderer-built paths use "/" separators; explorer.exe rejects
    // mixed separators, so normalize to the platform's form here.
    shell.showItemInFolder(nodePath.normalize(path));
  },
  openExternal: async ({ url }) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error(`Refusing to open non-web URL: ${url}`);
    }
    await shell.openExternal(url);
  },
};
