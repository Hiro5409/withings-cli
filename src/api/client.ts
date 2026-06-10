import type { TokenSet } from "../config/credentials.ts";
import { loadCredentials, saveCredentials, withCredentialsLock } from "../config/credentials.ts";
import { AuthError, CliError } from "../errors.ts";
import { getTokenStatus, refreshAccessToken } from "./auth.ts";

async function ensureValidToken(configDir: string, profile: string): Promise<TokenSet> {
  const creds = loadCredentials(configDir);
  const tokenSet = creds[profile];

  if (!tokenSet) {
    throw new AuthError(`No credentials for profile "${profile}". Run "withings login" first.`);
  }

  if (getTokenStatus(tokenSet).isValid) return tokenSet;

  return withCredentialsLock(configDir, async () => {
    const lockedCreds = loadCredentials(configDir);
    const lockedTokenSet = lockedCreds[profile];

    if (!lockedTokenSet) {
      throw new AuthError(`No credentials for profile "${profile}". Run "withings login" first.`);
    }

    if (getTokenStatus(lockedTokenSet).isValid) return lockedTokenSet;

    const refreshed = await refreshAccessToken(lockedTokenSet);
    lockedCreds[profile] = refreshed;
    saveCredentials(configDir, lockedCreds);
    return refreshed;
  });
}

async function authHeaders(configDir: string, profile: string): Promise<{ Authorization: string }> {
  const token = await ensureValidToken(configDir, profile);
  return { Authorization: `Bearer ${token.accessToken}` };
}

// Withings is an RPC-style API: every service is a form-encoded POST that
// answers HTTP 200 with a { status, body } envelope. Callers check the
// envelope status themselves (see assertWithingsOk) so they can keep the
// raw response for `--format json` output.
export async function postWithingsForm(params: {
  url: string;
  form: URLSearchParams;
  configDir: string;
  profile: string;
}): Promise<unknown> {
  const headers = await authHeaders(params.configDir, params.profile);
  const res = await fetch(params.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: params.form,
  });

  if (!res.ok) {
    throw new CliError(`Withings request failed (${res.status}): ${await res.text()}`, 4);
  }

  return res.json();
}
