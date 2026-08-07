export const queryKeys = {
  config: ["config"] as const,
  mods: ["mods"] as const,
  folderState: (folder: string) => ["folderState", folder] as const,
  remoteOverview: ["remote", "overview"] as const,
  remoteModInfo: (name: string) => ["remote", "modInfo", name] as const,
  remoteMissing: (names: string[]) => ["remote", "missing", ...names] as const,
} as const;
