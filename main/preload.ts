// Preload script — runs in an isolated context with access to Node +
// Electron APIs. Exposes a typed `window.api` to the renderer.
import { contextBridge } from "electron";
import { config, dialog, folderState, mods, runtime, shell, updater } from "@shared/ipc/client";

const api = {
  // Synchronous platform tag so the renderer can branch chrome rendering
  // without waiting on an IPC round-trip.
  platform: process.platform,
  config,
  dialog,
  folderState,
  mods,
  runtime,
  shell,
  updater,
} as const;

export type RendererApi = typeof api;

contextBridge.exposeInMainWorld("api", api);
