import { join } from "node:path";

export function configDir(): string {
  if (process.env.WITHINGS_CLI_CONFIG_DIR) return process.env.WITHINGS_CLI_CONFIG_DIR;
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return join(home, ".config", "withings-cli");
}
