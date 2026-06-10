import type { TokenSet } from "../config/credentials.ts";
import { loadCredentials, saveCredentials } from "../config/credentials.ts";
import { AuthError } from "../errors.ts";
import { client } from "../types/withings/client.gen.ts";
import { getTokenStatus, refreshAccessToken } from "./auth.ts";

export { client };

const refreshPromises = new Map<string, Promise<TokenSet>>();

function refreshKey(configDir: string, profile: string): string {
  return `${configDir}\0${profile}`;
}

export async function ensureValidToken(configDir: string, profile: string): Promise<TokenSet> {
  const creds = loadCredentials(configDir);
  const tokenSet = creds[profile];

  if (!tokenSet) {
    throw new AuthError(`No credentials for profile "${profile}". Run "withings login" first.`);
  }

  if (getTokenStatus(tokenSet).isValid) return tokenSet;

  const key = refreshKey(configDir, profile);
  if (!refreshPromises.has(key)) {
    const refreshPromise = refreshAccessToken(tokenSet)
      .then((refreshed) => {
        const current = loadCredentials(configDir);
        current[profile] = refreshed;
        saveCredentials(configDir, current);
        return refreshed;
      })
      .finally(() => {
        refreshPromises.delete(key);
      });
    refreshPromises.set(key, refreshPromise);
  }

  const refreshPromise = refreshPromises.get(key);
  if (!refreshPromise) throw new AuthError("Token refresh did not start.");
  return refreshPromise;
}

export async function authHeaders(
  configDir: string,
  profile: string,
): Promise<{ Authorization: string }> {
  const token = await ensureValidToken(configDir, profile);
  return { Authorization: `Bearer ${token.accessToken}` };
}
