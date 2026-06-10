import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCredentials } from "../config/credentials.js";
import { FileTokenStore } from "./file.js";

const tempDirs: string[] = [];

function tempConfigDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "withings-cli-store-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTokenStore preserves credentials format and private modes", async () => {
  const dir = tempConfigDir();
  const store = new FileTokenStore({ configDir: dir, profile: "default" });

  await store.save({
    clientId: "client",
    clientSecret: "secret",
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: 1,
  });

  expect(await store.load()).toEqual(loadCredentials(dir).default);
  expect(statSync(dir).mode & 0o777).toBe(0o700);
  expect(statSync(join(dir, "credentials.json")).mode & 0o777).toBe(0o600);
});

test("FileTokenStore removes only its profile", async () => {
  const dir = tempConfigDir();
  const first = new FileTokenStore({ configDir: dir, profile: "default" });
  const second = new FileTokenStore({ configDir: dir, profile: "work" });

  await first.save({
    clientId: "client",
    clientSecret: "secret",
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: 1,
  });
  await second.save({
    clientId: "client2",
    clientSecret: "secret2",
    accessToken: "access2",
    refreshToken: "refresh2",
    expiresAt: 2,
  });

  await first.remove();

  expect(await first.load()).toBeUndefined();
  expect((await second.load())?.accessToken).toBe("access2");
});

test("FileTokenStore allows save while already inside its refresh lock", async () => {
  const dir = tempConfigDir();
  const store = new FileTokenStore({ configDir: dir, profile: "default" });

  await store.withRefreshLock(async () => {
    await store.save({
      clientId: "client",
      clientSecret: "secret",
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: 1,
    });
  });

  expect((await store.load())?.refreshToken).toBe("refresh");
});
