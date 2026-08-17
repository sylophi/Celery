// In-app auto-update built on Electron's `autoUpdater` (Squirrel.Mac on
// macOS, Squirrel.Windows under an installed Windows build), pointed at
// update.electronjs.org, which filters to the latest non-draft GitHub
// release and does the version comparison. The portable Windows zip has
// no Squirrel Update.exe to apply updates with, so it (and dev builds)
// reports `unsupported` and the renderer shows a caption instead of a
// dead button.
//
// Override `CELERY_UPDATE_FEED_URL` to point at a local server for
// end-to-end testing of a packaged build.
import { app, autoUpdater } from "electron";
import { REPO_SLUG } from "@shared/app";
import { updaterContract } from "@shared/ipc/modules/updater";
import type { UpdaterState } from "@shared/schemas";
import { broadcastAll } from "../ipc/register";
import { isMac, platformId } from "../lib/util/platform";
import { isSquirrelInstall } from "./squirrel";

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
  // The macOS zip is always an updatable install, Windows only under a
  // Squirrel one (the portable zip has no Update.exe). The override
  // deliberately sits behind this gate: feed testing must not activate
  // the updater on builds with no Squirrel runtime to apply the result.
  if (!isMac && !isSquirrelInstall) return null;
  const override = process.env["CELERY_UPDATE_FEED_URL"]?.trim();
  if (override) return override;
  return `https://update.electronjs.org/${REPO_SLUG}/${platformId}-${process.arch}/${app.getVersion()}`;
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
    // macOS reports the release name ("v0.1.0"), Windows the bare
    // version from RELEASES. It's the one per-platform argument the
    // docs don't guarantee, hence the absent fallback.
    setState({
      kind: "ready",
      version: releaseName?.replace(/^v/, "") || undefined,
    });
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
