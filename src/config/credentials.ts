import {
  chmodSync,
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { TokenSet } from "../api/client.js";
import { integerOrUndefined, isObject } from "../api/parse.js";
import { ConfigError } from "../errors.js";

export type Credentials = Record<string, TokenSet>;
const MALFORMED_LOCK_STALE_MS = 60_000;

function isErrnoException(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && "code" in e;
}

function ensureCredentialPathIsRegular(filePath: string): void {
  try {
    if (lstatSync(filePath).isSymbolicLink()) {
      throw new ConfigError("credentials.json must not be a symbolic link.");
    }
  } catch (e) {
    if (isErrnoException(e) && e.code === "ENOENT") return;
    throw e;
  }
}

function prepareCredentialsDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
}

function normalizeTokenSet(value: unknown): TokenSet | undefined {
  if (!isObject(value)) return undefined;
  const candidate = value;
  const userid = integerOrUndefined(candidate.userid);
  if (
    typeof candidate.clientId === "string" &&
    typeof candidate.clientSecret === "string" &&
    typeof candidate.accessToken === "string" &&
    typeof candidate.refreshToken === "string" &&
    typeof candidate.expiresAt === "number" &&
    (candidate.userid === undefined || userid !== undefined) &&
    (candidate.scope === undefined || typeof candidate.scope === "string") &&
    (candidate.tokenType === undefined || typeof candidate.tokenType === "string") &&
    (candidate.csrfToken === undefined || typeof candidate.csrfToken === "string")
  ) {
    return {
      clientId: candidate.clientId,
      clientSecret: candidate.clientSecret,
      accessToken: candidate.accessToken,
      refreshToken: candidate.refreshToken,
      expiresAt: candidate.expiresAt,
      ...(userid === undefined ? {} : { userid }),
      ...(typeof candidate.scope === "string" ? { scope: candidate.scope } : {}),
      ...(typeof candidate.tokenType === "string" ? { tokenType: candidate.tokenType } : {}),
      ...(typeof candidate.csrfToken === "string" ? { csrfToken: candidate.csrfToken } : {}),
    };
  }
  return undefined;
}

function parseCredentials(value: unknown): Credentials {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigError("credentials.json must contain an object.");
  }

  const parsed: Credentials = {};
  for (const [profile, tokenSet] of Object.entries(value)) {
    const normalizedTokenSet = normalizeTokenSet(tokenSet);
    if (!normalizedTokenSet) {
      throw new ConfigError(`Invalid credentials for profile "${profile}".`);
    }
    parsed[profile] = normalizedTokenSet;
  }
  return parsed;
}

export function loadCredentials(dir: string): Credentials {
  const filePath = join(dir, "credentials.json");
  try {
    const raw = readFileSync(filePath, "utf-8");
    return parseCredentials(JSON.parse(raw));
  } catch (e) {
    if (isErrnoException(e) && e.code === "ENOENT") return {};
    if (e instanceof ConfigError) throw e;
    throw new ConfigError(
      `Failed to parse credentials.json: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function saveCredentials(dir: string, credentials: Credentials): void {
  prepareCredentialsDir(dir);
  const filePath = join(dir, "credentials.json");
  ensureCredentialPathIsRegular(filePath);

  const tempPath = join(
    dir,
    `.credentials.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`,
  );
  try {
    writeFileSync(tempPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
    chmodSync(tempPath, 0o600);
    renameSync(tempPath, filePath);
    chmodSync(filePath, 0o600);
  } catch (e) {
    try {
      unlinkSync(tempPath);
    } catch {
      // Best effort cleanup; the original credentials file was not replaced.
    }
    throw e;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryCreateLock(lockPath: string): number | undefined {
  try {
    const fd = openSync(lockPath, "wx", 0o600);
    writeFileSync(fd, `${process.pid}\n`);
    return fd;
  } catch (e) {
    if (isErrnoException(e) && e.code === "EEXIST") return undefined;
    throw e;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !(isErrnoException(e) && e.code === "ESRCH");
  }
}

function readLockPid(lockPath: string): number | undefined {
  try {
    const value = Number(readFileSync(lockPath, "utf-8").trim());
    return Number.isInteger(value) && value > 0 ? value : undefined;
  } catch (e) {
    if (isErrnoException(e) && e.code === "ENOENT") return undefined;
    throw e;
  }
}

function removeDeadLockOwner(lockPath: string): boolean {
  const pid = readLockPid(lockPath);
  if (pid !== undefined && isProcessRunning(pid)) return false;

  if (pid === undefined) {
    const lockAgeMs = Date.now() - statSync(lockPath).mtimeMs;
    if (lockAgeMs < MALFORMED_LOCK_STALE_MS) return false;
  }

  try {
    unlinkSync(lockPath);
    return true;
  } catch (e) {
    if (isErrnoException(e) && e.code === "ENOENT") return true;
    throw e;
  }
}

export async function withCredentialsLock<T>(
  dir: string,
  fn: () => Promise<T>,
  timeoutMs = 10_000,
): Promise<T> {
  prepareCredentialsDir(dir);
  const lockPath = join(dir, "credentials.lock");
  const start = Date.now();
  let fd: number | undefined;

  while (fd === undefined) {
    fd = tryCreateLock(lockPath);
    if (fd !== undefined) break;
    if (removeDeadLockOwner(lockPath)) continue;
    if (Date.now() - start >= timeoutMs) {
      const lockAgeMs = Date.now() - statSync(lockPath).mtimeMs;
      throw new ConfigError(
        `Timed out waiting for credentials lock at ${lockPath} (${Math.round(lockAgeMs)}ms old).`,
      );
    }
    await sleep(50);
  }

  try {
    return await fn();
  } finally {
    closeSync(fd);
    try {
      unlinkSync(lockPath);
    } catch {
      // If another process cleaned it up, there is nothing useful to do here.
    }
  }
}
