import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { PublisherGithub } from "@electron-forge/publisher-github";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { rename } from "node:fs/promises";
import { APP_BUNDLE_ID, REPO } from "./shared/app";

// Target platform of this build: the host by default, overridden by
// `--platform win32` when cross-packaging (shigomori's helper).
function targetPlatform(): string {
  const eq = process.argv.find((a) => a.startsWith("--platform="));
  if (eq) return eq.slice("--platform=".length);
  const idx = process.argv.findIndex((a) => a === "--platform" || a === "-p");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  return process.platform;
}
const isWindowsTarget = targetPlatform() === "win32";

// The Windows exe name, doubling as Squirrel's nuget package id and
// install directory (%LocalAppData%\celery). The pieces must agree or
// Update.exe can't find the app it manages. Space-free on purpose.
const APP_SLUG = "celery";
// Windows support is experimental, and the downloads carry that caveat
// in their filenames (see postMake and setupExe below).
const EXPERIMENTAL_SUFFIX = "-experimental";

const shouldSignMac = Boolean(process.env.APPLE_SIGNING_IDENTITY);
const osxNotarizeConfig =
  process.env.APPLE_ID &&
  process.env.APPLE_APP_SPECIFIC_PASSWORD &&
  process.env.APPLE_TEAM_ID
    ? {
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      }
    : undefined;

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: "assets/icon",
    appBundleId: APP_BUNDLE_ID,
    appCopyright: "© 2026 sylophi",
    // Portable Windows zip: keep the exe name space-free and stable.
    // Scoped to win32 so the macOS bundle keeps its productName binary.
    ...(isWindowsTarget ? { executableName: APP_SLUG } : {}),
    ...(shouldSignMac
      ? { osxSign: { identity: process.env.APPLE_SIGNING_IDENTITY } }
      : {}),
    ...(shouldSignMac && osxNotarizeConfig
      ? { osxNotarize: osxNotarizeConfig }
      : {}),
  },
  rebuildConfig: {},
  hooks: {
    // Windows support is experimental; put that in the artifact name so
    // the download itself carries the caveat (shigomori's convention).
    postMake: async (_forgeConfig, makeResults) =>
      Promise.all(
        makeResults.map(async (result) => {
          if (result.platform !== "win32") return result;
          const artifacts = await Promise.all(
            result.artifacts.map(async (artifact) => {
              const renamed = artifact.replace(
                /\.zip$/,
                `${EXPERIMENTAL_SUFFIX}.zip`,
              );
              if (renamed === artifact) return artifact;
              await rename(artifact, renamed);
              return renamed;
            }),
          );
          return { ...result, artifacts };
        }),
      ),
  },
  // Both platforms ship as plain zips; on Windows that's a portable app
  // (unzip anywhere, run the exe) with no auto-update. Windows also gets
  // a Squirrel installer, which is what the in-app updater works under.
  // The Squirrel artifacts (RELEASES, .nupkg) must keep their canonical
  // names (update.electronjs.org serves them verbatim), so only the
  // setup exe carries the experimental caveat, via `setupExe` rather
  // than the postMake zip-rename hook above.
  makers: [
    new MakerZIP({}, ["darwin", "win32"]),
    new MakerSquirrel({
      name: APP_SLUG,
      authors: REPO.owner,
      setupExe: `${APP_SLUG}-setup${EXPERIMENTAL_SUFFIX}.exe`,
      setupIcon: "assets/icon.ico",
      // Shown by Add/Remove Programs. Squirrel wants a URL, not a file.
      iconUrl: `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}/main/assets/icon.ico`,
      noMsi: true,
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: REPO,
      draft: false,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "main/index.ts",
          config: "vite.main.config.mts",
          target: "main",
        },
        {
          entry: "main/preload.ts",
          config: "vite.preload.config.mts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
