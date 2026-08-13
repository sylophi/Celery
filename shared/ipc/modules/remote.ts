import { z } from "zod";
import { broadcast, invoke } from "../contract";
import {
  InstallPlanSchema,
  InstallResultSchema,
  RemoteModInfoSchema,
  RemoteOverviewSchema,
  RemoteProgressSchema,
  UpdateResultSchema,
} from "../../schemas/remote";

export const remoteContract = {
  // Joins the local scan against the update database: category, latest
  // version and update-available per file. Cheap after first fetch.
  overview: invoke("remote:overview", z.void(), RemoteOverviewSchema),
  // Rich GameBanana metadata for one mod, looked up by everest.yaml
  // Name. Null when offline or the mod isn't on GameBanana.
  modInfo: invoke(
    "remote:modInfo",
    z.object({ name: z.string() }),
    RemoteModInfoSchema.nullable(),
  ),
  // Expands missing dependency names into a transitive install plan
  // (a missing dep's own deps may also be missing).
  resolveMissing: invoke(
    "remote:resolveMissing",
    z.object({ names: z.array(z.string()) }),
    InstallPlanSchema,
  ),
  // Downloads, verifies and places the named mods into the Mods
  // folder. Progress arrives via the broadcast below.
  install: invoke(
    "remote:install",
    z.object({ names: z.array(z.string()) }),
    InstallResultSchema,
  ),
  // Replaces installed zips with the database's latest build, keeping
  // each fileName so blacklist/favorites entries stay valid untouched.
  // Takes a batch because updating is usually a sweep; one mod is just
  // a batch of one.
  update: invoke(
    "remote:update",
    z.object({ fileNames: z.array(z.string()) }),
    UpdateResultSchema,
  ),
  progress: broadcast("remote:progress", RemoteProgressSchema),
} as const;
