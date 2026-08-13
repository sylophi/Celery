// Preload script. Runs in an isolated context with access to Node +
// Electron APIs. Exposes a typed `window.api` to the renderer.
import { contextBridge } from "electron";
import { TRAFFIC_LIGHT_INSET } from "@shared/chrome";
import {
  config,
  dialog,
  folderState,
  mods,
  remote,
  runtime,
  shell,
  updater,
} from "@shared/ipc/client";

const api = {
  // Synchronous platform tag so the renderer can branch chrome rendering
  // without waiting on an IPC round-trip.
  platform: process.platform,
  // How much of the toolbar's leading edge the native window buttons
  // take. Only macOS puts them there; Windows reports its trailing-edge
  // claim to CSS itself, through the Window Controls Overlay.
  chromeInsetStart: process.platform === "darwin" ? TRAFFIC_LIGHT_INSET : 0,
  config,
  dialog,
  folderState,
  mods,
  remote,
  runtime,
  shell,
  updater,
} as const;

export type RendererApi = typeof api;

contextBridge.exposeInMainWorld("api", api);
