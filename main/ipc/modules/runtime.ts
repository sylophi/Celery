import { app, nativeTheme } from "electron";
import type { Handlers } from "@shared/ipc/types";
import { runtimeContract } from "@shared/ipc/modules/runtime";
import type { HandlerContext } from "../register";
import { readGlobalConfig, writeGlobalConfig } from "../../lib/config";

export const runtimeHandlers: Handlers<typeof runtimeContract, HandlerContext> = {
  info: () => ({ version: app.getVersion(), platform: process.platform }),

  setTheme: async ({ theme }) => {
    nativeTheme.themeSource = theme;
    const config = await readGlobalConfig();
    await writeGlobalConfig({ ...config, theme });
  },
};
