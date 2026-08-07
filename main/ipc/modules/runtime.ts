import { app, nativeTheme } from "electron";
import { platformId } from "../../lib/util/platform";
import type { Handlers } from "@shared/ipc/types";
import { runtimeContract } from "@shared/ipc/modules/runtime";
import type { HandlerContext } from "../register";
import { readGlobalConfig, writeGlobalConfig } from "../../lib/config";

export const runtimeHandlers: Handlers<typeof runtimeContract, HandlerContext> =
  {
    info: () => ({ version: app.getVersion(), platform: platformId }),

    setTheme: async ({ theme }) => {
      nativeTheme.themeSource = theme;
      const config = await readGlobalConfig();
      await writeGlobalConfig({ ...config, theme });
    },
  };
