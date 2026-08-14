import { mkdir } from "node:fs/promises";
import { app } from "electron";

// All app state lives in Electron's standard userData directory
// (~/Library/Application Support/Celery on macOS, %APPDATA%\Celery on
// Windows). Dev sessions get a -dev suffix so they never touch real
// state. Must run before anything reads userData.
export function initCeleryRoot(isPackaged: boolean): void {
  if (!isPackaged) {
    app.setPath("userData", `${app.getPath("userData")}-dev`);
  }
}

export function celeryRoot(): string {
  return app.getPath("userData");
}

export async function ensureCeleryRoot(): Promise<void> {
  await mkdir(celeryRoot(), { recursive: true });
}
