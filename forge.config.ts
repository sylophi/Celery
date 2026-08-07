import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerZIP } from "@electron-forge/maker-zip";
import { PublisherGithub } from "@electron-forge/publisher-github";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { rename } from "node:fs/promises";

const shouldSignMac = Boolean(process.env.APPLE_SIGNING_IDENTITY);
const osxNotarizeConfig =
  process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID
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
    appBundleId: "com.sylophi.celery",
    appCopyright: "© 2026 sylophi",
    // Portable Windows zip: keep the exe name space-free and stable.
    executableName: "celery",
    ...(shouldSignMac ? { osxSign: { identity: process.env.APPLE_SIGNING_IDENTITY } } : {}),
    ...(shouldSignMac && osxNotarizeConfig ? { osxNotarize: osxNotarizeConfig } : {}),
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
              const renamed = artifact.replace(/\.zip$/, "-experimental.zip");
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
  // (unzip anywhere, run the exe) with no installer or auto-update.
  makers: [new MakerZIP({}, ["darwin", "win32"])],
  publishers: [
    new PublisherGithub({
      repository: { owner: "sylophi", name: "celery" },
      draft: false,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "main/index.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "main/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
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
