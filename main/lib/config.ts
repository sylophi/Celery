import {
  GlobalConfigSchema,
  type GlobalConfig,
  type Theme,
} from "@shared/schemas";
import { readJsonFile, readJsonFileSync, writeJsonFile } from "./store";

const CONFIG_FILE = "config.json";

export function readGlobalConfig(): Promise<GlobalConfig> {
  return readJsonFile(CONFIG_FILE, GlobalConfigSchema, {});
}

export function writeGlobalConfig(config: GlobalConfig): Promise<void> {
  return writeJsonFile(CONFIG_FILE, config);
}

// Sync path for window construction: nativeTheme must be set before the
// BrowserWindow exists so vibrancy/chrome first-paint the right variant.
export function readThemeSync(): Theme {
  return (
    readJsonFileSync(CONFIG_FILE, GlobalConfigSchema, {}).theme ?? "system"
  );
}
