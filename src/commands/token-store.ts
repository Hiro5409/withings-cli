import { configDir } from "../config/config.js";
import { FileTokenStore } from "../stores/file.js";

export function tokenStoreForProfile(profile: string): FileTokenStore {
  return new FileTokenStore({ configDir: configDir(), profile });
}
