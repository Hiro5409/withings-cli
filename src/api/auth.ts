import * as v from "valibot";
import { AuthError } from "../errors.js";
import { isObject } from "./parse.js";
import { UserIdSchema, type TokenSet } from "./token.js";

const WITHINGS_AUTH_BASE = "https://account.withings.com";
const WITHINGS_API_BASE = "https://wbsapi.withings.net";
const AUTHORIZE_PATH = "/oauth2_user/authorize2";
const TOKEN_PATH = "/v2/oauth2";

export const CALLBACK_PORT = 8765;
export const CALLBACK_PATH = "/auth/withings/callback";
export const DEFAULT_REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
export const DEFAULT_SCOPE = "user.metrics";

const TokenEndpointResponseSchema = v.object({
  userid: v.optional(UserIdSchema),
  access_token: v.pipe(v.string(), v.nonEmpty()),
  refresh_token: v.pipe(v.string(), v.nonEmpty()),
  expires_in: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  scope: v.optional(v.string()),
  csrf_token: v.optional(v.string()),
  token_type: v.optional(v.string()),
});

type TokenEndpointResponse = v.InferOutput<typeof TokenEndpointResponseSchema>;

function parseTokenEndpointResponse(value: unknown): TokenEndpointResponse {
  if (!isObject(value)) {
    throw new AuthError("Token endpoint returned a non-object response.");
  }

  const envelope = value;
  if (typeof envelope.status === "number" && envelope.status !== 0) {
    throw new AuthError(`Token endpoint returned Withings status ${envelope.status}.`);
  }

  const result = v.safeParse(
    TokenEndpointResponseSchema,
    isObject(envelope.body) ? envelope.body : envelope,
  );
  if (!result.success) {
    throw new AuthError("Token endpoint returned an invalid response.");
  }
  return result.output;
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
