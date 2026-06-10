import { randomBytes } from "node:crypto";
import type { TokenSet } from "../config/credentials.ts";
import { loadCredentials, saveCredentials } from "../config/credentials.ts";
import { AuthError } from "../errors.ts";

const WITHINGS_AUTH_BASE = "https://account.withings.com";
const AUTHORIZE_PATH = "/oauth2_user/authorize2";
const TOKEN_PATH = "/oauth2_user/token";

export const CALLBACK_PORT = 8765;
export const CALLBACK_PATH = "/auth/withings/callback";
export const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
export const DEFAULT_SCOPE = "user.metrics";

type TokenEndpointResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

function parseTokenEndpointResponse(value: unknown): TokenEndpointResponse {
  if (!value || typeof value !== "object") {
    throw new AuthError("Token endpoint returned a non-object response.");
  }
  const data = value as Record<string, unknown>;
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
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    scope: typeof data.scope === "string" ? data.scope : undefined,
  };
}

export function buildAuthorizationUrl(params: {
  clientId: string;
  state: string;
  scope?: string;
}): string {
  const url = new URL(`${WITHINGS_AUTH_BASE}${AUTHORIZE_PATH}`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", params.scope ?? DEFAULT_SCOPE);
  url.searchParams.set("state", params.state);
  return url.toString();
}

async function postTokenEndpoint(body: Record<string, string>): Promise<TokenEndpointResponse> {
  const res = await fetch(`${WITHINGS_AUTH_BASE}${TOKEN_PATH}`, {
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
}): Promise<TokenSet> {
  const data = await postTokenEndpoint({
    action: "requesttoken",
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: REDIRECT_URI,
  });

  return {
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
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
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? tokenSet.scope,
  };
}

export function removeProfile(configDir: string, profile: string): void {
  const creds = loadCredentials(configDir);
  delete creds[profile];
  saveCredentials(configDir, creds);
}

export function getTokenStatus(tokenSet: TokenSet): { isValid: boolean; expiresAt: Date } {
  return {
    isValid: tokenSet.expiresAt > Date.now() + 30_000,
    expiresAt: new Date(tokenSet.expiresAt),
  };
}

export function generateState(): string {
  return randomBytes(16).toString("hex");
}
