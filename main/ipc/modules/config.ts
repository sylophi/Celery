import type { Handlers } from "@shared/ipc/types";
import { configContract } from "@shared/ipc/modules/config";
import type { HandlerContext } from "../register";
import { readGlobalConfig, writeGlobalConfig } from "../../lib/config";

export const configHandlers: Handlers<typeof configContract, HandlerContext> = {
  read: () => readGlobalConfig(),
  write: ({ config }) => writeGlobalConfig(config),
};
