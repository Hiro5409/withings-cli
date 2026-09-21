import { configDir } from "../config/config.js";
import { FileTokenStore } from "../stores/file.js";

const DEFAULT_PROFILE = "default";

export function profileName(profile?: string): string {
  return profile ?? DEFAULT_PROFILE;
}

export function tokenStoreForProfile(profile?: string): FileTokenStore {
  return new FileTokenStore({ configDir: configDir(), profile: profileName(profile) });
}
