import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigError } from "../errors.ts";

export type TokenSet = {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
};

export type Credentials = Record<string, TokenSet>;

function isErrnoException(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && "code" in e;
}

function isTokenSet(value: unknown): value is TokenSet {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.clientId === "string" &&
    typeof candidate.clientSecret === "string" &&
    typeof candidate.accessToken === "string" &&
    typeof candidate.refreshToken === "string" &&
    typeof candidate.expiresAt === "number" &&
    (candidate.scope === undefined || typeof candidate.scope === "string")
  );
}

function parseCredentials(value: unknown): Credentials {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigError("credentials.json must contain an object.");
  }

  const parsed: Credentials = {};
  for (const [profile, tokenSet] of Object.entries(value)) {
    if (!isTokenSet(tokenSet)) {
      throw new ConfigError(`Invalid credentials for profile "${profile}".`);
    }
    parsed[profile] = tokenSet;
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
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const filePath = join(dir, "credentials.json");
  writeFileSync(filePath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
}
