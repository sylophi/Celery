export const queryKeys = {
  config: ["config"] as const,
  // Scoped by folder, like folderState below: a snapshot only ever
  // describes the folder it was scanned in, so pointing Celery at
  // another one has to be a cache miss rather than a stale read.
  // `modsAll` is the prefix everything that invalidates a scan uses.
  modsAll: ["mods"] as const,
  mods: (folder: string) => ["mods", folder] as const,
  folderState: (folder: string) => ["folderState", folder] as const,
  remoteOverview: ["remote", "overview"] as const,
  remoteModInfo: (name: string) => ["remote", "modInfo", name] as const,
  remoteMissing: (names: string[]) => ["remote", "missing", ...names] as const,
} as const;
