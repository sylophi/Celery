import { app, BrowserWindow, nativeTheme } from "electron";
import path from "node:path";
import { readThemeSync } from "./lib/config";
import { registerIpcHandlers } from "./ipc";
import { attachContextMenu } from "./electron/contextMenu";
import { startUpdater } from "./electron/updater";
import { ensureCeleryRoot, initCeleryRoot } from "./lib/util/paths";
import { isMac, isWindows } from "./lib/util/platform";

// A stable explicit AppUserModelID keeps taskbar grouping and pins
// working for the portable Windows build (the default AUMID is derived
// from the exe path, so moving the unzipped folder would orphan pins).
if (isWindows) {
  app.setAppUserModelId("com.sylophi.celery");
}

initCeleryRoot(app.isPackaged);
registerIpcHandlers();

let mainWindow: BrowserWindow | null = null;

// Windows chrome colors must track the renderer theme by hand; sRGB
// duplicates of the v1 tokens (bg-white / neutral-900). The window
// background matches `--background` so resize flashes blend in; the
// 28px overlay matches the standard caption-button strip (shigomori's
// win32 chrome recipe).
function chromeColors() {
  const dark = nativeTheme.shouldUseDarkColors;
  return {
    backgroundColor: dark ? "#171717" : "#ffffff",
    overlay: {
      color: dark ? "#171717" : "#ffffff",
      symbolColor: dark ? "#fafafa" : "#171717",
      height: 28,
    },
  };
}

const createWindow = () => {
  // Drive the native appearance from the saved theme before constructing
  // the window so the shell first-paints the right light/dark variant.
  // "system" delegates back to the OS.
  nativeTheme.themeSource = readThemeSync();
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 720,
    minWidth: 800,
    minHeight: 520,
    // macOS chrome: inset traffic lights over the app's own toolbar.
    ...(isMac
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 16, y: 18 },
          backgroundColor: chromeColors().backgroundColor,
        }
      : isWindows
        ? {
            titleBarStyle: "hidden" as const,
            titleBarOverlay: chromeColors().overlay,
            backgroundColor: chromeColors().backgroundColor,
            // Without this Electron still draws the menu-bar row in the
            // client area despite the hidden title bar; Alt reveals it.
            autoHideMenuBar: true,
          }
        : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Single local document; no in-page navigation or popup is ever
  // legitimate. Same-URL navigation stays allowed for dev full reload.
  const webContents = mainWindow.webContents;
  webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  webContents.on("will-navigate", (event, url) => {
    if (url !== webContents.getURL()) event.preventDefault();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  attachContextMenu(mainWindow);
};

// The window's own background is what shows during a resize, before the
// renderer repaints, so it has to follow the theme too.
nativeTheme.on("updated", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { backgroundColor, overlay } = chromeColors();
  mainWindow.setBackgroundColor(backgroundColor);
  if (isWindows) mainWindow.setTitleBarOverlay?.(overlay);
});

app.on("ready", async () => {
  await ensureCeleryRoot();
  createWindow();
  startUpdater();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
