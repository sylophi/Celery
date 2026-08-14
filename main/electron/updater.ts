// In-app auto-update built on Electron's `autoUpdater` (Squirrel.Mac),
// pointed at update.electronjs.org, which filters to the latest
// non-draft GitHub release and does the version comparison. macOS-only:
// the Windows build is a portable zip with no installer, and Electron's
// Windows autoUpdater only works under a Squirrel install. Windows (and
// dev) builds report `unsupported` so the renderer shows a caption
// instead of a dead button.
//
// Override `CELERY_UPDATE_FEED_URL` to point at a local server for
// end-to-end testing of a signed build.
import { app, autoUpdater } from "electron";
import { updaterContract } from "@shared/ipc/modules/updater";
import type { UpdaterState } from "@shared/schemas";
import { broadcastAll } from "../ipc/register";
import { isMac } from "../lib/util/platform";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let state: UpdaterState = { kind: "idle" };
let started = false;

function setState(next: UpdaterState): void {
  state = next;
  broadcastAll(updaterContract, "state", state);
}

export function getUpdaterState(): UpdaterState {
  return state;
}

function buildFeedUrl(): string | null {
  if (!isMac) return null;
  const override = process.env["CELERY_UPDATE_FEED_URL"]?.trim();
  if (override) return override;
  return `https://update.electronjs.org/sylophi/celery/darwin-${process.arch}/${app.getVersion()}`;
}

export function checkForUpdates(): void {
  if (!started) return;
  // No-op once an update is ready; the only useful action left is install.
  if (state.kind === "ready" || state.kind === "downloading") return;
  setState({ kind: "checking" });
  try {
    autoUpdater.checkForUpdates();
  } catch (err) {
    setState({
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export function installUpdate(): void {
  if (state.kind !== "ready") return;
  try {
    autoUpdater.quitAndInstall();
  } catch (err) {
    setState({
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startUpdater(): void {
  if (started) return;
  const feedUrl = app.isPackaged ? buildFeedUrl() : null;
  if (!feedUrl) {
    setState({ kind: "unsupported" });
    return;
  }

  try {
    autoUpdater.setFeedURL({
      url: feedUrl,
      headers: { "User-Agent": `celery/${app.getVersion()}` },
    });
  } catch (err) {
    setState({
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  autoUpdater.on("checking-for-update", () => {
    if (state.kind !== "ready") setState({ kind: "checking" });
  });
  autoUpdater.on("update-available", () => {
    if (state.kind !== "ready") setState({ kind: "downloading" });
  });
  autoUpdater.on("update-not-available", () => {
    if (state.kind !== "ready") setState({ kind: "idle" });
  });
  autoUpdater.on("update-downloaded", (_event, _notes, releaseName) => {
    const version = releaseName?.startsWith("v")
      ? releaseName.slice(1)
      : (releaseName ?? "");
    setState({ kind: "ready", version });
  });
  autoUpdater.on("error", (err) => {
    setState({
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  });

  started = true;
  checkForUpdates();
  // Runs for the app's lifetime; quit tears the interval down.
  setInterval(checkForUpdates, CHECK_INTERVAL_MS);
}
