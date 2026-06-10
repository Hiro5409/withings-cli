import { AsyncLocalStorage } from "node:async_hooks";
import type { TokenSet, TokenStore } from "../api/client.js";
import { loadCredentials, saveCredentials, withCredentialsLock } from "../config/credentials.js";

const lockContext = new AsyncLocalStorage<Set<string>>();

export class FileTokenStore implements TokenStore {
  constructor(
    private readonly params: {
      configDir: string;
      profile: string;
    },
  ) {}

  async load(): Promise<TokenSet | undefined> {
    return this.withFileLock(
      async () => loadCredentials(this.params.configDir)[this.params.profile],
    );
  }

  async save(tokenSet: TokenSet): Promise<void> {
    await this.withFileLock(async () => {
      const credentials = loadCredentials(this.params.configDir);
      credentials[this.params.profile] = tokenSet;
      saveCredentials(this.params.configDir, credentials);
    });
  }

  async remove(): Promise<void> {
    await this.withFileLock(async () => {
      const credentials = loadCredentials(this.params.configDir);
      delete credentials[this.params.profile];
      saveCredentials(this.params.configDir, credentials);
    });
  }

  async withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
    return this.withFileLock(fn);
  }

  private async withFileLock<T>(fn: () => Promise<T>): Promise<T> {
    const currentLocks = lockContext.getStore();
    if (currentLocks?.has(this.params.configDir)) return fn();

    return withCredentialsLock(this.params.configDir, async () => {
      const nextLocks = new Set(currentLocks);
      nextLocks.add(this.params.configDir);
      return lockContext.run(nextLocks, fn);
    });
  }
}

export async function removeProfile(configDir: string, profile: string): Promise<void> {
  await new FileTokenStore({ configDir, profile }).remove();
}
