// Pure dependency-graph derivation over a ModsSnapshot. Used by both
// the renderer (graph view, cascade previews) and main (nothing yet),
// so no Electron or DOM imports allowed here.
import type { ModFile, ModsSnapshot } from "./schemas/mods";

// The loader and the game appear as dependencies but are not files in
// the Mods folder; they never become graph nodes or cascade targets.
export const PSEUDO_MODS = new Set(["Everest", "EverestCore", "Celeste"]);

export type ModIndex = {
  files: ModFile[];
  byFileName: Map<string, ModFile>;
  // Mod Name -> providing file. One file can provide several names
  // (multi-entry manifests); a name maps to exactly one file.
  providerOf: Map<string, string>;
  // fileName -> fileNames it hard-depends on (resolved, deduped, no
  // self-edges: a sub-mod depending on its own parent zip collapses).
  hardDeps: Map<string, Set<string>>;
  optionalDeps: Map<string, Set<string>>;
  // Reverse hard edges: fileName -> fileNames that hard-depend on it.
  dependents: Map<string, Set<string>>;
  // Reverse optional edges.
  optionalDependents: Map<string, Set<string>>;
  // fileName -> declared dependency Names no installed file provides
  // (pseudo-mods excluded).
  missing: Map<string, string[]>;
};

export function buildIndex(snapshot: ModsSnapshot): ModIndex {
  const byFileName = new Map<string, ModFile>();
  const providerOf = new Map<string, string>();
  for (const file of snapshot.files) {
    byFileName.set(file.fileName, file);
  }
  for (const file of snapshot.files) {
    for (const entry of file.entries) {
      const existing = providerOf.get(entry.name);
      if (existing === undefined) {
        providerOf.set(entry.name, file.fileName);
        continue;
      }
      // Duplicate providers (two zips shipping the same mod Name):
      // prefer the enabled copy. That's the one Everest actually
      // loads, so edges, cascades, and orphan detection should bind
      // to it rather than to whichever sorts first.
      const existingFile = byFileName.get(existing)!;
      if (!existingFile.enabled && file.enabled) {
        providerOf.set(entry.name, file.fileName);
      }
    }
  }

  const hardDeps = new Map<string, Set<string>>();
  const optionalDeps = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  const optionalDependents = new Map<string, Set<string>>();
  const missing = new Map<string, string[]>();

  for (const file of snapshot.files) {
    const hard = new Set<string>();
    const optional = new Set<string>();
    const missingNames: string[] = [];
    for (const entry of file.entries) {
      for (const dep of entry.dependencies) {
        if (PSEUDO_MODS.has(dep.name)) continue;
        const provider = providerOf.get(dep.name);
        if (!provider) missingNames.push(dep.name);
        else if (provider !== file.fileName) hard.add(provider);
      }
      for (const dep of entry.optionalDependencies) {
        if (PSEUDO_MODS.has(dep.name)) continue;
        const provider = providerOf.get(dep.name);
        if (provider && provider !== file.fileName && !hard.has(provider)) {
          optional.add(provider);
        }
      }
    }
    hardDeps.set(file.fileName, hard);
    optionalDeps.set(file.fileName, optional);
    if (missingNames.length > 0) missing.set(file.fileName, missingNames);
    for (const dep of hard) {
      let set = dependents.get(dep);
      if (!set) dependents.set(dep, (set = new Set()));
      set.add(file.fileName);
    }
    for (const dep of optional) {
      let set = optionalDependents.get(dep);
      if (!set) optionalDependents.set(dep, (set = new Set()));
      set.add(file.fileName);
    }
  }

  return {
    files: snapshot.files,
    byFileName,
    providerOf,
    hardDeps,
    optionalDeps,
    dependents,
    optionalDependents,
    missing,
  };
}

function walk(
  starts: Iterable<string>,
  edges: Map<string, Set<string>>,
): Set<string> {
  const seen = new Set<string>();
  const stack = [...starts];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of edges.get(current) ?? []) {
      if (!seen.has(next)) stack.push(next);
    }
  }
  return seen;
}

// Transitive hard-dependency closure, including the start files.
export function depClosure(index: ModIndex, fileNames: string[]): Set<string> {
  return walk(fileNames, index.hardDeps);
}

// Transitive hard dependents, including the start files.
export function dependentClosure(
  index: ModIndex,
  fileNames: string[],
): Set<string> {
  return walk(fileNames, index.dependents);
}

export type EnablePlan = {
  // The files the user asked to enable (already-enabled ones excluded).
  targets: string[];
  // Disabled dependencies that must be enabled alongside them.
  cascade: string[];
};

export function planEnable(index: ModIndex, fileNames: string[]): EnablePlan {
  const targets = fileNames.filter(
    (f) => index.byFileName.get(f)?.enabled === false,
  );
  const closure = depClosure(index, targets);
  const cascade = [...closure]
    .filter((f) => !targets.includes(f))
    .filter((f) => index.byFileName.get(f)?.enabled === false)
    .toSorted();
  return { targets, cascade };
}

export type DisablePlan = {
  targets: string[];
  // Enabled mods (outside the targets) that hard-depend, transitively,
  // on something being disabled; they'd break unless disabled too.
  brokenDependents: string[];
  // Requested mods that stay enabled because an enabled mod outside the
  // request still needs them. Disabling one anyway means taking those
  // dependents down with it.
  kept: string[];
};

export function planDisable(index: ModIndex, fileNames: string[]): DisablePlan {
  const requested = new Set(
    fileNames.filter((f) => index.byFileName.get(f)?.enabled === true),
  );
  // Enabled mods not being disabled, plus everything they transitively
  // need, must survive. Requested files inside that closure are kept.
  const survivors = [...index.files]
    .filter((f) => f.enabled && !requested.has(f.fileName))
    .map((f) => f.fileName);
  const needed = depClosure(index, survivors);
  const kept = [...requested].filter((f) => needed.has(f)).toSorted();
  const targets = [...requested].filter((f) => !needed.has(f)).toSorted();
  // Anything enabled outside the request that depends on a target is
  // broken. (Only reachable when the caller ignores `kept`, a forced
  // disable, but computed so the UI can warn either way.)
  const brokenDependents = [...dependentClosure(index, targets)]
    .filter((f) => !requested.has(f))
    .filter((f) => index.byFileName.get(f)?.enabled === true)
    .toSorted();
  return { targets, brokenDependents, kept };
}

// ENABLED support-material files (helpers, asset packs, audio) that no
// other ENABLED mod references, paired with every installed mod that
// does reference them. Deliberately relative to the enabled set rather
// than the installed set: a disabled collab "using" a helper doesn't
// justify Everest loading that helper. Favorites are skipped, since a
// starred mod is kept on purpose. Hard and optional referrers count the
// same — either is a mod that asked for this.
//
// Both problems below are read off this one pass, and the difference
// between them is only whether the pairing came back empty.
function idleSupportMods(
  index: ModIndex,
): { file: string; wantedBy: string[] }[] {
  const result: { file: string; wantedBy: string[] }[] = [];
  for (const file of index.files) {
    if (!file.enabled || file.favorite) continue;
    const supportish = file.tags.every(
      (t) => t === "helper" || t === "asset-pack" || t === "audio",
    );
    if (!supportish || file.tags.length === 0) continue;
    const referrers = [
      ...(index.dependents.get(file.fileName) ?? []),
      ...(index.optionalDependents.get(file.fileName) ?? []),
    ];
    if (referrers.some((r) => index.byFileName.get(r)?.enabled)) continue;
    result.push({ file: file.fileName, wantedBy: referrers.toSorted() });
  }
  return result.toSorted((a, b) => a.file.localeCompare(b.file));
}

// Orphans: nothing in the folder lists them as a dependency — not an
// enabled mod, not a disabled one. Nothing is coming back for them, so
// the answer is to delete them.
export function findOrphans(index: ModIndex): string[] {
  return idleSupportMods(index)
    .filter((entry) => entry.wantedBy.length === 0)
    .map((entry) => entry.file);
}

export type Unused = {
  fileName: string;
  // The installed mods that want it, all of them currently disabled.
  wantedBy: string[];
};

// Unused: mods DO ask for these, but every one of those mods is
// disabled, so Everest is loading them for nobody. Deleting one would
// break its dependents the moment they came back; disabling costs
// nothing, because re-enabling any of them pulls this in again through
// the hard-dep cascade. So the answer is to stop loading them.
export function findUnused(index: ModIndex): Unused[] {
  return idleSupportMods(index)
    .filter((entry) => entry.wantedBy.length > 0)
    .map((entry) => ({ fileName: entry.file, wantedBy: entry.wantedBy }));
}
