import { define } from "gunshi";
import colors from "yoctocolors";
import {
  buildAuthorizationUrl,
  CALLBACK_PATH,
  CALLBACK_PORT,
  DEFAULT_SCOPE,
  exchangeCodeForToken,
  generateState,
} from "../../api/auth.ts";
import { configDir } from "../../config/config.ts";
import { loadCredentials, saveCredentials } from "../../config/credentials.ts";
import { ConfigError } from "../../errors.ts";
import { globalArgs } from "../../global-args.ts";

export const loginCommand = define({
  name: "login",
  description: "Authenticate with Withings via OAuth2",
  args: {
    ...globalArgs,
    scope: {
      type: "string",
      description: "OAuth scopes to request",
      default: DEFAULT_SCOPE,
    },
  },
  run: async (ctx) => {
    const profile = String(ctx.values.profile ?? "default");
    const scope = String(ctx.values.scope ?? DEFAULT_SCOPE);
    const clientId = process.env.WITHINGS_CLIENT_ID;
    const clientSecret = process.env.WITHINGS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new ConfigError(
        "Set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET environment variables.",
      );
    }

    const state = generateState();
    const authUrl = buildAuthorizationUrl({ clientId, state, scope });

    console.log(colors.dim("Opening browser for authentication..."));
    console.log(`If the browser does not open, visit:\n${authUrl}\n`);

    const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
    Bun.spawn([openCmd, authUrl], { stdout: "ignore", stderr: "ignore" });

    const { code } = await waitForCallback(state);
    const tokenSet = await exchangeCodeForToken({ clientId, clientSecret, code });

    const dir = configDir();
    const creds = loadCredentials(dir);
    creds[profile] = tokenSet;
    saveCredentials(dir, creds);

    console.log(colors.green(`Authenticated successfully as profile "${profile}".`));
  },
});

function waitForCallback(expectedState: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const server = Bun.serve({
      port: CALLBACK_PORT,
      hostname: "127.0.0.1",
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== CALLBACK_PATH) {
          return new Response("Not found", { status: 404 });
        }

        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        if (returnedState !== expectedState) {
          clearTimeout(timeout);
          server.stop();
          reject(new Error("State mismatch; authentication failed."));
          return new Response("State mismatch. Authentication failed.", { status: 400 });
        }

        if (!code) {
          const error =
            url.searchParams.get("error_description") ?? "No authorization code received";
          clearTimeout(timeout);
          server.stop();
          reject(new Error(error));
          return new Response(`Authentication failed: ${error}`, { status: 400 });
        }

        clearTimeout(timeout);
        server.stop();
        resolve({ code });
        return new Response("Authentication successful. You can close this tab.", {
          headers: { "Content-Type": "text/html" },
        });
      },
    });

    const timeout = setTimeout(() => {
      server.stop();
      reject(new Error("Authentication timed out after 120 seconds."));
    }, 120_000);
  });
}
