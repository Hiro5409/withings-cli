import { afterEach, expect, test } from "bun:test";
import { createWithingsClient } from "../index.js";
import type { TokenSet, TokenStore } from "./client.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function token(overrides: Partial<TokenSet> = {}): TokenSet {
  return {
    clientId: "client",
    clientSecret: "secret",
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: Date.now() + 3_600_000,
    ...overrides,
  };
}

class MemoryTokenStore implements TokenStore {
  saves: TokenSet[] = [];

  constructor(public current: TokenSet | undefined) {}

  async load(): Promise<TokenSet | undefined> {
    return this.current;
  }

  async save(tokenSet: TokenSet): Promise<void> {
    this.saves.push(tokenSet);
    this.current = tokenSet;
  }
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
}

test("createWithingsClient refreshes an expired token and saves the rotated token", async () => {
  const store = new MemoryTokenStore(
    token({
      accessToken: "old-access",
      refreshToken: "old-refresh",
      expiresAt: Date.now() - 1_000,
    }),
  );
  const authorizations: (string | null)[] = [];

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url === "https://wbsapi.withings.net/v2/oauth2") {
      const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams();
      expect(body.get("refresh_token")).toBe("old-refresh");
      return jsonResponse({
        status: 0,
        body: {
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
        },
      });
    }

    authorizations.push(new Headers(init?.headers).get("Authorization"));
    return jsonResponse({ status: 0, body: { devices: [] } });
  }) as typeof fetch;

  await createWithingsClient({ store }).raw({
    service: "user",
    action: "getdevice",
    fields: {},
  });

  expect(store.saves).toHaveLength(1);
  expect(store.saves[0]?.accessToken).toBe("new-access");
  expect(store.current?.refreshToken).toBe("new-refresh");
  expect(authorizations).toEqual(["Bearer new-access"]);
});

test("createWithingsClient uses a valid token without saving", async () => {
  const store = new MemoryTokenStore(token({ accessToken: "valid-access" }));
  const urls: string[] = [];

  globalThis.fetch = (async (input, init) => {
    urls.push(String(input));
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer valid-access");
    return jsonResponse({ status: 0, body: { devices: [] } });
  }) as typeof fetch;

  await createWithingsClient({ store }).raw({
    service: "user",
    action: "getdevice",
    fields: {},
  });

  expect(store.saves).toHaveLength(0);
  expect(urls).toEqual(["https://wbsapi.withings.net/v2/user"]);
});

test("createWithingsClient rechecks token state inside a store refresh lock", async () => {
  const store = new MemoryTokenStore(
    token({ expiresAt: Date.now() - 1_000 }),
  ) as MemoryTokenStore & {
    withRefreshLock<T>(fn: () => Promise<T>): Promise<T>;
  };

  store.withRefreshLock = async (fn) => {
    store.current = token({ accessToken: "already-refreshed" });
    return fn();
  };

  globalThis.fetch = (async (input, init) => {
    expect(String(input)).toBe("https://wbsapi.withings.net/v2/user");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer already-refreshed");
    return jsonResponse({ status: 0, body: { devices: [] } });
  }) as typeof fetch;

  await createWithingsClient({ store }).raw({
    service: "user",
    action: "getdevice",
    fields: {},
  });

  expect(store.saves).toHaveLength(0);
});
