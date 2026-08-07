import { configContract } from "@shared/ipc/modules/config";
import { dialogContract } from "@shared/ipc/modules/dialog";
import { folderStateContract } from "@shared/ipc/modules/folderState";
import { modsContract } from "@shared/ipc/modules/mods";
import { runtimeContract } from "@shared/ipc/modules/runtime";
import { shellContract } from "@shared/ipc/modules/shell";
import { updaterContract } from "@shared/ipc/modules/updater";
import { registerContract } from "./register";
import { configHandlers } from "./modules/config";
import { dialogHandlers } from "./modules/dialog";
import { folderStateHandlers } from "./modules/folderState";
import { modsHandlers } from "./modules/mods";
import { runtimeHandlers } from "./modules/runtime";
import { shellHandlers } from "./modules/shell";
import { updaterHandlers } from "./modules/updater";

export function registerIpcHandlers(): void {
  registerContract(configContract, configHandlers);
  registerContract(dialogContract, dialogHandlers);
  registerContract(folderStateContract, folderStateHandlers);
  registerContract(modsContract, modsHandlers);
  registerContract(runtimeContract, runtimeHandlers);
  registerContract(shellContract, shellHandlers);
  registerContract(updaterContract, updaterHandlers);
}
