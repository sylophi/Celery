export const isMac = process.platform === "darwin";
export const isWindows = process.platform === "win32";
// For code that needs the raw platform string (e.g. runtime:info); the
// lint ban on process.platform routes everything through this module.
export const platformId = process.platform;
