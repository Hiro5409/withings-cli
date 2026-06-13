import { afterEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigError } from "../errors.js";
import { loadCredentials, saveCredentials, withCredentialsLock } from "./credentials.js";

const tempDirs: string[] = [];

function tempConfigDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "withings-cli-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("saveCredentials enforces private file and directory modes", () => {
  const dir = tempConfigDir();
  const filePath = join(dir, "credentials.json");
  saveCredentials(dir, {});
  chmodSync(dir, 0o755);
  chmodSync(filePath, 0o644);

  saveCredentials(dir, {
    default: {
      clientId: "client",
      clientSecret: "secret",
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: 1,
    },
  });

  expect(statSync(dir).mode & 0o777).toBe(0o700);
  expect(statSync(filePath).mode & 0o777).toBe(0o600);
  expect(loadCredentials(dir).default?.refreshToken).toBe("refresh");
});

test("loadCredentials normalizes a numeric string userid", () => {
  const dir = tempConfigDir();
  saveCredentials(dir, {});
  writeFileSync(
    join(dir, "credentials.json"),
    `${JSON.stringify(
      {
        default: {
          userid: "123",
          clientId: "client",
          clientSecret: "secret",
          accessToken: "access",
          refreshToken: "refresh",
          expiresAt: 1,
        },
      },
      null,
      2,
    )}\n`,
  );

  expect(loadCredentials(dir).default?.userid).toBe(123);
});

test("saveCredentials refuses to replace a symlinked credentials file", () => {
  const dir = tempConfigDir();
  const target = join(dir, "target.json");
  const filePath = join(dir, "credentials.json");
  writeFileSync(target, "{}\n");
  symlinkSync(target, filePath);

  expect(() => saveCredentials(dir, {})).toThrow(ConfigError);
  expect(readFileSync(target, "utf-8")).toBe("{}\n");
});

test("withCredentialsLock serializes concurrent work", async () => {
  const dir = tempConfigDir();
  const order: string[] = [];

  const first = withCredentialsLock(dir, async () => {
    order.push("first-start");
    await new Promise((resolve) => setTimeout(resolve, 50));
    order.push("first-end");
  });

  await new Promise((resolve) => setTimeout(resolve, 5));

  const second = withCredentialsLock(dir, async () => {
    order.push("second");
  });

  await Promise.all([first, second]);

  expect(order).toEqual(["first-start", "first-end", "second"]);
  expect(existsSync(join(dir, "credentials.lock"))).toBe(false);
});

test("withCredentialsLock recovers a lock left by a dead process", async () => {
  const dir = tempConfigDir();
  saveCredentials(dir, {});
  const lockPath = join(dir, "credentials.lock");
  writeFileSync(lockPath, "999999999\n");

  const result = await withCredentialsLock(dir, async () => "ok");

  expect(result).toBe("ok");
  expect(existsSync(lockPath)).toBe(false);
});

test("withCredentialsLock recovers an old malformed lock", async () => {
  const dir = tempConfigDir();
  saveCredentials(dir, {});
  const lockPath = join(dir, "credentials.lock");
  const oldDate = new Date(Date.now() - 120_000);
  writeFileSync(lockPath, "");
  utimesSync(lockPath, oldDate, oldDate);

  const result = await withCredentialsLock(dir, async () => "ok");

  expect(result).toBe("ok");
  expect(existsSync(lockPath)).toBe(false);
});

test("withCredentialsLock timeout includes the lock path", async () => {
  const dir = tempConfigDir();
  saveCredentials(dir, {});
  const lockPath = join(dir, "credentials.lock");
  writeFileSync(lockPath, `${process.pid}\n`);

  await expect(withCredentialsLock(dir, async () => "ok", 1)).rejects.toThrow(lockPath);
});
