import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { releaseState } from "./release-state.js";

const input = {
  name: "withings-cli",
  version: "1.2.3",
  repository: "Hiro5409/withings-cli",
  filename: "withings-cli-1.2.3.tgz",
  bytes: Buffer.from("tested artifact"),
  token: "test-token",
};
const published = {
  dist: { integrity: `sha512-${createHash("sha512").update(input.bytes).digest("base64")}` },
};
const asset = {
  name: input.filename,
  digest: `sha256:${createHash("sha256").update(input.bytes).digest("hex")}`,
};

const npmUrl = "https://registry.npmjs.org/withings-cli/1.2.3";
const releaseUrl = "https://api.github.com/repos/Hiro5409/withings-cli/releases/tags/v1.2.3";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const notFound = () => new Response(null, { status: 404 });

function serve(routes: Record<string, (authorization: string | null) => Response>) {
  globalThis.fetch = (async (url, init) => {
    const route = typeof url === "string" ? routes[url] : undefined;
    if (!route) throw new Error("Unexpected request");
    return route(new Headers(init?.headers).get("authorization"));
  }) as typeof fetch;
}

async function failure(state: Promise<unknown>): Promise<string> {
  const error: unknown = await state.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  if (!(error instanceof Error)) throw new Error("Expected the lookup to fail");
  return error.message;
}

test.each([
  { npm: false, release: false },
  { npm: true, release: false },
  { npm: true, release: true },
])("releaseState resumes npm=$npm release=$release", async (state) => {
  serve({
    [npmUrl]: (authorization) => {
      expect(authorization).toBeNull();
      return state.npm ? Response.json(published) : notFound();
    },
    [releaseUrl]: (authorization) => {
      expect(authorization).toBe("Bearer test-token");
      return state.release ? Response.json({ assets: [asset] }) : notFound();
    },
  });

  expect(await releaseState(input)).toEqual({
    npmPublished: state.npm,
    releaseExists: state.release,
  });
});

test("releaseState waits for npm to serve a published version before reading GitHub", async () => {
  const lookups: string[] = [];
  serve({
    [npmUrl]: () => {
      lookups.push("npm");
      return lookups.length < 3 ? notFound() : Response.json(published);
    },
    [releaseUrl]: () => {
      lookups.push("github");
      return notFound();
    },
  });

  expect(await releaseState({ ...input, npmWait: { timeoutMs: 60_000, intervalMs: 1 } })).toEqual({
    npmPublished: true,
    releaseExists: false,
  });
  expect(lookups).toEqual(["npm", "npm", "npm", "github"]);
});

test("releaseState stops waiting when npm does not serve the version in time", async () => {
  serve({ [npmUrl]: notFound });

  expect(
    await failure(releaseState({ ...input, npmWait: { timeoutMs: 20, intervalMs: 5 } })),
  ).toContain("npm is not serving withings-cli@1.2.3");
});

test("releaseState does not read an npm lookup failure as unpublished", async () => {
  serve({ [npmUrl]: () => new Response(null, { status: 500 }) });

  expect(await failure(releaseState(input))).toContain("HTTP 500");
});

test("releaseState stops waiting when an npm lookup fails", async () => {
  const lookups: string[] = [];
  serve({
    [npmUrl]: () => {
      lookups.push("npm");
      return lookups.length < 2 ? notFound() : new Response(null, { status: 503 });
    },
    [releaseUrl]: () => {
      lookups.push("github");
      return notFound();
    },
  });

  expect(
    await failure(releaseState({ ...input, npmWait: { timeoutMs: 50, intervalMs: 1 } })),
  ).toContain("HTTP 503");
  expect(lookups).toEqual(["npm", "npm"]);
});

test("releaseState stops when npm serves contents other than the tested artifact", async () => {
  serve({ [npmUrl]: () => Response.json({ dist: { integrity: "different" } }) });

  expect(await failure(releaseState(input))).toContain("Published npm artifact differs");
});

test("releaseState stops when npm serves other contents after the wait", async () => {
  let lookups = 0;
  serve({
    [npmUrl]: () => {
      lookups += 1;
      return lookups < 2 ? notFound() : Response.json({ dist: { integrity: "different" } });
    },
  });

  expect(
    await failure(releaseState({ ...input, npmWait: { timeoutMs: 60_000, intervalMs: 1 } })),
  ).toContain("Published npm artifact differs");
});

test("releaseState stops when the GitHub lookup fails", async () => {
  serve({
    [npmUrl]: () => Response.json(published),
    [releaseUrl]: () => new Response(null, { status: 503 }),
  });

  expect(await failure(releaseState(input))).toContain("HTTP 503");
});

test("releaseState stops when a release carries a different artifact", async () => {
  serve({
    [npmUrl]: () => Response.json(published),
    [releaseUrl]: () => Response.json({ assets: [{ ...asset, digest: "different" }] }),
  });

  expect(await failure(releaseState(input))).toContain("Existing release asset differs");
});

test("releaseState stops when a release lacks the tested artifact", async () => {
  serve({
    [npmUrl]: () => Response.json(published),
    [releaseUrl]: () => Response.json({ assets: [{ ...asset, name: "withings-cli-1.2.2.tgz" }] }),
  });

  expect(await failure(releaseState(input))).toContain(
    "Existing release is missing withings-cli-1.2.3.tgz",
  );
});
