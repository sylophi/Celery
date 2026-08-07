export const queryKeys = {
  config: ["config"] as const,
  mods: ["mods"] as const,
  folderState: (folder: string) => ["folderState", folder] as const,
} as const;
