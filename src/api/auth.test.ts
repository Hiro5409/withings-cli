import { afterEach, expect, test } from "bun:test";
import { exchangeCodeForToken, refreshAccessToken } from "./auth.js";
import type { TokenSet } from "./client.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
}

function token(overrides: Partial<TokenSet> = {}): TokenSet {
  return {
    clientId: "client",
    clientSecret: "secret",
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: 1,
    ...overrides,
  };
}

test("exchangeCodeForToken normalizes a string userid from the token endpoint", async () => {
  globalThis.fetch = (async (input, init) => {
    expect(String(input)).toBe("https://wbsapi.withings.net/v2/oauth2");
    expect(init?.method).toBe("POST");
    return jsonResponse({
      status: 0,
      body: {
        userid: "123",
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
      },
    });
  }) as typeof fetch;

  const tokenSet = await exchangeCodeForToken({
    clientId: "client",
    clientSecret: "secret",
    code: "code",
    redirectUri: "http://localhost/callback",
  });

  expect(tokenSet.userid).toBe(123);
});

test("refreshAccessToken backfills userid when the refresh response includes it", async () => {
  globalThis.fetch = (async (input, init) => {
    expect(String(input)).toBe("https://wbsapi.withings.net/v2/oauth2");
    expect(init?.method).toBe("POST");
    return jsonResponse({
      status: 0,
      body: {
        userid: "456",
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 3600,
      },
    });
  }) as typeof fetch;

  const refreshed = await refreshAccessToken(token({ userid: undefined }));

  expect(refreshed.userid).toBe(456);
  expect(refreshed.accessToken).toBe("new-access");
  expect(refreshed.refreshToken).toBe("new-refresh");
});

test("refreshAccessToken keeps an existing userid when the refresh response omits it", async () => {
  globalThis.fetch = (async (input, init) => {
    expect(String(input)).toBe("https://wbsapi.withings.net/v2/oauth2");
    expect(init?.method).toBe("POST");
    return jsonResponse({
      status: 0,
      body: {
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 3600,
      },
    });
  }) as typeof fetch;

  const refreshed = await refreshAccessToken(token({ userid: 789 }));

  expect(refreshed.userid).toBe(789);
});
