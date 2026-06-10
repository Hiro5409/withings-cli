import { AuthError, CliError } from "../errors.js";
import { getTokenStatus, refreshAccessToken } from "./auth.js";

export type TokenSet = {
  userid?: number;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
  csrfToken?: string;
};

/**
 * Storage for one Withings OAuth token set.
 *
 * Withings refresh tokens rotate. If multiple requests may refresh the same
 * token concurrently, the store implementation must serialize that refresh
 * path, for example with a Durable Object, database transaction, or file lock.
 */
export type TokenStore = {
  load(): Promise<TokenSet | undefined>;
  save(tokenSet: TokenSet): Promise<void>;

  /**
   * Optional single-flight boundary for the load -> refresh -> save sequence.
   * Implement this when concurrent requests can refresh the same token set.
   */
  withRefreshLock?<T>(fn: () => Promise<T>): Promise<T>;
};

async function refreshAndSaveToken(store: TokenStore): Promise<TokenSet> {
  const tokenSet = await store.load();

  if (!tokenSet) {
    throw new AuthError('No credentials found. Run "withings login" first.');
  }

  if (getTokenStatus(tokenSet).isValid) return tokenSet;

  const refreshed = await refreshAccessToken(tokenSet);
  await store.save(refreshed);
  return refreshed;
}

async function ensureValidToken(store: TokenStore): Promise<TokenSet> {
  const tokenSet = await store.load();

  if (!tokenSet) {
    throw new AuthError('No credentials found. Run "withings login" first.');
  }

  if (getTokenStatus(tokenSet).isValid) return tokenSet;

  if (store.withRefreshLock) {
    return store.withRefreshLock(() => refreshAndSaveToken(store));
  }

  return refreshAndSaveToken(store);
}

async function authHeaders(store: TokenStore): Promise<{ Authorization: string }> {
  const token = await ensureValidToken(store);
  return { Authorization: `Bearer ${token.accessToken}` };
}

// Withings is an RPC-style API: every service is a form-encoded POST that
// answers HTTP 200 with a { status, body } envelope. Callers check the
// envelope status themselves (see assertWithingsOk) so they can keep the
// raw response for `--format json` output.
export async function postWithingsForm(params: {
  url: string;
  form: URLSearchParams;
  store: TokenStore;
}): Promise<unknown> {
  const headers = await authHeaders(params.store);
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
