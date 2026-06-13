import type { TokenSet } from "./client.js";
import { AuthError } from "../errors.js";
import { integerOrUndefined, isObject } from "./parse.js";

const WITHINGS_AUTH_BASE = "https://account.withings.com";
const WITHINGS_API_BASE = "https://wbsapi.withings.net";
const AUTHORIZE_PATH = "/oauth2_user/authorize2";
const TOKEN_PATH = "/v2/oauth2";

export const CALLBACK_PORT = 8765;
export const CALLBACK_PATH = "/auth/withings/callback";
export const DEFAULT_REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
export const DEFAULT_SCOPE = "user.metrics";

type TokenEndpointResponse = {
  userid?: number;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  csrf_token?: string;
  token_type?: string;
};

function parseTokenEndpointResponse(value: unknown): TokenEndpointResponse {
  if (!isObject(value)) {
    throw new AuthError("Token endpoint returned a non-object response.");
  }

  const envelope = value;
  if (typeof envelope.status === "number" && envelope.status !== 0) {
    throw new AuthError(`Token endpoint returned Withings status ${envelope.status}.`);
  }

  const data = isObject(envelope.body) ? envelope.body : envelope;

  if (
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string" ||
    typeof data.expires_in !== "number"
  ) {
    throw new AuthError(
      "Token endpoint response is missing access_token, refresh_token, or expires_in.",
    );
  }
  return {
    userid: integerOrUndefined(data.userid),
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    scope: typeof data.scope === "string" ? data.scope : undefined,
    csrf_token: typeof data.csrf_token === "string" ? data.csrf_token : undefined,
    token_type: typeof data.token_type === "string" ? data.token_type : undefined,
  };
}

export function buildAuthorizationUrl(params: {
  clientId: string;
  state: string;
  redirectUri: string;
  scope?: string;
}): string {
  const url = new URL(`${WITHINGS_AUTH_BASE}${AUTHORIZE_PATH}`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scope ?? DEFAULT_SCOPE);
  url.searchParams.set("state", params.state);
  return url.toString();
}

async function postTokenEndpoint(body: Record<string, string>): Promise<TokenEndpointResponse> {
  const res = await fetch(`${WITHINGS_API_BASE}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AuthError(`Token request failed (${res.status}): ${text}`);
  }

  return parseTokenEndpointResponse(await res.json());
}

export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const data = await postTokenEndpoint({
    action: "requesttoken",
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  return {
    userid: data.userid,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
    tokenType: data.token_type,
    csrfToken: data.csrf_token,
  };
}

export async function refreshAccessToken(tokenSet: TokenSet): Promise<TokenSet> {
  const data = await postTokenEndpoint({
    action: "requesttoken",
    grant_type: "refresh_token",
    client_id: tokenSet.clientId,
    client_secret: tokenSet.clientSecret,
    refresh_token: tokenSet.refreshToken,
  });

  return {
    ...tokenSet,
    userid: tokenSet.userid ?? data.userid,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? tokenSet.scope,
    tokenType: data.token_type ?? tokenSet.tokenType,
    csrfToken: data.csrf_token ?? tokenSet.csrfToken,
  };
}

export function getTokenStatus(tokenSet: TokenSet): { isValid: boolean; expiresAt: Date } {
  return {
    isValid: tokenSet.expiresAt > Date.now() + 30_000,
    expiresAt: new Date(tokenSet.expiresAt),
  };
}

export function generateState(): string {
  return crypto.randomUUID();
}
