import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

async function runCli(...args: string[]) {
  const configDir = await mkdtemp(join(tmpdir(), "withings-cli-test-"));
  try {
    const child = Bun.spawn([process.execPath, "src/main.ts", ...args], {
      cwd: projectRoot,
      env: { ...Bun.env, NO_COLOR: "1", WITHINGS_CLI_CONFIG_DIR: configDir },
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    return { exitCode, stderr, stdout };
  } finally {
    await rm(configDir, { recursive: true });
  }
}

test("prints the package version", async () => {
  const result = await runCli("--version");

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
});

test("shows help for raw measure-getmeas without parent positional arguments", async () => {
  const result = await runCli("raw", "measure-getmeas", "--help");

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("withings raw measure-getmeas <OPTIONS>");
});

test("dispatches generic raw API calls through the call command", async () => {
  const result = await runCli("raw", "call", "user", "getdevice", "--format", "json");

  expect(result.exitCode).toBe(2);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr)).toMatchObject({
    error: 'No credentials found. Run "withings login" first.',
    exitCode: 2,
  });
});

test("rejects a profile option without a value", async () => {
  const result = await runCli("logout", "--profile");

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("profile");
  expect(result.stdout).not.toContain("Removed credentials");
});

test("rejects a comment option without a value", async () => {
  const result = await runCli(
    "notify",
    "subscribe",
    "--callbackurl",
    "https://example.com/withings",
    "--appli",
    "1",
    "--comment",
  );

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("comment");
});

test("rejects invalid calendar dates before authentication", async () => {
  const result = await runCli(
    "activity",
    "--startdateymd",
    "2026-02-30",
    "--enddateymd",
    "2026-03-01",
  );

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("startdateymd must be a valid calendar date.");
});

test("prints one structured JSON error when argument parsing fails", async () => {
  const result = await runCli(
    "activity",
    "--format",
    "json",
    "--startdateymd",
    "2026-02-30",
    "--enddateymd",
    "2026-03-01",
  );

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr)).toEqual({
    error: "startdateymd must be a valid calendar date.",
    exitCode: 1,
  });
});
