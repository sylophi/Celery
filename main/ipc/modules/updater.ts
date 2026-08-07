import type { Handlers } from "@shared/ipc/types";
import { updaterContract } from "@shared/ipc/modules/updater";
import type { HandlerContext } from "../register";
import {
  checkForUpdates,
  getUpdaterState,
  installUpdate,
} from "../../electron/updater";

export const updaterHandlers: Handlers<typeof updaterContract, HandlerContext> =
  {
    get: () => getUpdaterState(),
    check: () => {
      checkForUpdates();
    },
    install: () => {
      installUpdate();
    },
  };
