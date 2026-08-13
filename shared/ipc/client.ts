import { buildClient } from "@shared/ipc/buildClient";
import { configContract } from "@shared/ipc/modules/config";
import { dialogContract } from "@shared/ipc/modules/dialog";
import { folderStateContract } from "@shared/ipc/modules/folderState";
import { modsContract } from "@shared/ipc/modules/mods";
import { remoteContract } from "@shared/ipc/modules/remote";
import { runtimeContract } from "@shared/ipc/modules/runtime";
import { shellContract } from "@shared/ipc/modules/shell";
import { updaterContract } from "@shared/ipc/modules/updater";
import type { FolderState, GlobalConfig, Theme } from "@shared/schemas";

const configClient = buildClient(configContract);
const dialogClient = buildClient(dialogContract);
const folderStateClient = buildClient(folderStateContract);
const modsClient = buildClient(modsContract);
const remoteClient = buildClient(remoteContract);
const runtimeClient = buildClient(runtimeContract);
const shellClient = buildClient(shellContract);
const updaterClient = buildClient(updaterContract);

export const config = {
  read: configClient.read,
  write: (value: GlobalConfig) => configClient.write({ config: value }),
} as const;

export const dialog = {
  pickFolder: (options?: { title?: string }) =>
    dialogClient.pickFolder(options),
} as const;

export const folderState = {
  read: (folder: string) => folderStateClient.read({ folder }),
  write: (folder: string, state: FolderState) =>
    folderStateClient.write({ folder, state }),
} as const;

export const mods = {
  scan: modsClient.scan,
  setEnabled: (changes: { fileName: string; enabled: boolean }[]) =>
    modsClient.setEnabled({ changes }),
  setFavorite: (fileName: string, favorite: boolean) =>
    modsClient.setFavorite({ fileName, favorite }),
  remove: (fileNames: string[]) => modsClient.remove({ fileNames }),
} as const;

export const remote = {
  overview: remoteClient.overview,
  modInfo: (name: string) => remoteClient.modInfo({ name }),
  resolveMissing: (names: string[]) => remoteClient.resolveMissing({ names }),
  install: (names: string[]) => remoteClient.install({ names }),
  update: (fileName: string) => remoteClient.update({ fileName }),
  onProgress: remoteClient.progress,
} as const;

export const runtime = {
  info: runtimeClient.info,
  setTheme: (theme: Theme) => runtimeClient.setTheme({ theme }),
} as const;

export const shell = {
  showItemInFolder: (path: string) => shellClient.showItemInFolder({ path }),
  openExternal: (url: string) => shellClient.openExternal({ url }),
} as const;

export const updater = {
  get: updaterClient.get,
  check: updaterClient.check,
  install: updaterClient.install,
  onState: updaterClient.state,
} as const;
