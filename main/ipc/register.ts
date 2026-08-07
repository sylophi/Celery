// The only sanctioned place calling `webContents.send`. Inputs are
// parsed at the boundary; in dev, outputs are re-parsed too so handler
// drift surfaces here instead of as a confusing renderer failure.
import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import type { Contract } from "@shared/ipc/contract";
import type { BroadcastProducerPayload, Handlers } from "@shared/ipc/types";

export type HandlerContext = { event: IpcMainInvokeEvent };

const VALIDATE_OUTPUTS = !app.isPackaged;

export function registerContract<C extends Contract>(
  contract: C,
  handlers: Handlers<C, HandlerContext>,
): void {
  for (const key of Object.keys(contract) as (keyof C & string)[]) {
    const def = contract[key];
    if (def.kind !== "invoke") continue;
    const handler = (
      handlers as unknown as Record<string, (i: unknown, ctx: HandlerContext) => unknown>
    )[key];
    ipcMain.handle(def.channel, async (event, raw) => {
      const input = def.input.parse(raw);
      const result = await handler(input, { event });
      return VALIDATE_OUTPUTS ? def.output.parse(result) : result;
    });
  }
}

export function broadcast<C extends Contract, K extends keyof C>(
  contract: C,
  key: K,
  payload: BroadcastProducerPayload<C, K>,
  webContents: WebContents,
): void {
  const def = contract[key];
  if (def.kind !== "broadcast") {
    throw new Error(`broadcast called on non-broadcast key: ${String(key)}`);
  }
  webContents.send(def.channel, def.payload.parse(payload));
}

export function broadcastAll<C extends Contract, K extends keyof C>(
  contract: C,
  key: K,
  payload: BroadcastProducerPayload<C, K>,
): void {
  const def = contract[key];
  if (def.kind !== "broadcast") {
    throw new Error(`broadcastAll called on non-broadcast key: ${String(key)}`);
  }
  const parsed = def.payload.parse(payload);
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.webContents.isDestroyed()) continue;
    win.webContents.send(def.channel, parsed);
  }
}
