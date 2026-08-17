// Squirrel.Windows integration. The installer launches the app with a
// `--squirrel-*` flag on install/update/uninstall so the app itself can
// (un)register its shortcuts through Squirrel's Update.exe and exit.
// Inlined rather than depending on `electron-squirrel-startup`. Same
// shape, plus the spawn-error handling that package lacks.
import { app } from "electron";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { isWindows } from "../lib/util/platform";

// A Squirrel install lays the app out as %LocalAppData%\<package>\app-x.y.z\
// with Update.exe one level up. Requiring the versioned app-* directory
// as well as the Update.exe neighbour keeps a portable zip that happens
// to be unzipped inside some other Squirrel app's directory from
// matching. The layout is fixed for the process lifetime, so these are
// consts in the isMac/isWindows mould rather than repeated stats.
const updateExe = path.resolve(
  path.dirname(process.execPath),
  "..",
  "Update.exe",
);
export const isSquirrelInstall =
  isWindows &&
  /^app-\d+\./.test(path.basename(path.dirname(process.execPath))) &&
  existsSync(updateExe);

// The AUMID Update.exe stamps on the shortcuts it creates. The window
// must set the same one or taskbar pins stop grouping. Derived from the
// install layout (the package id is the install directory's name, the
// exe name is forge's executableName) so it tracks forge.config.ts
// instead of mirroring it by hand.
export const squirrelAppUserModelId = `com.squirrel.${path.basename(
  path.dirname(path.dirname(process.execPath)),
)}.${path.basename(process.execPath, ".exe")}`;

// Runs Update.exe and quits once it finishes (or fails to start). The
// wait matters: Squirrel resumes as soon as this process exits, and on
// uninstall that means deleting the install tree out from under the
// shortcut removal.
function runUpdateExe(args: string[]): void {
  spawn(updateExe, args, { detached: true })
    .once("error", () => app.quit())
    .once("close", () => app.quit());
}

// Returns true when this launch is one of Squirrel's install-time
// events. The app then quits from here (once Update.exe completes) and
// the caller must skip all normal startup.
export function handleSquirrelStartup(): boolean {
  if (!isSquirrelInstall) return false;
  const exe = path.basename(process.execPath);
  switch (process.argv[1]) {
    case "--squirrel-install":
    case "--squirrel-updated":
      runUpdateExe([`--createShortcut=${exe}`]);
      return true;
    case "--squirrel-uninstall":
      runUpdateExe([`--removeShortcut=${exe}`]);
      return true;
    case "--squirrel-obsolete":
      app.quit();
      return true;
    default:
      return false;
  }
}
