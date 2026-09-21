import { define } from "gunshi";
import { args, merge } from "gunshi/combinators";
import colors from "yoctocolors";
import {
  buildAuthorizationUrl,
  CALLBACK_PATH,
  CALLBACK_PORT,
  DEFAULT_SCOPE,
  DEFAULT_REDIRECT_URI,
  exchangeCodeForToken,
  generateState,
} from "../../api/auth.js";
import { ConfigError } from "../../errors.js";
import { globalArgs } from "../../global-args.js";
import { nonEmptyStringArg } from "../../value-arg.js";
import { profileName, tokenStoreForProfile } from "../token-store.js";

const scope = nonEmptyStringArg("scope", `OAuth scopes to request (default: ${DEFAULT_SCOPE})`);

export const loginCommand = define({
  name: "login",
  description: "Authenticate with Withings via OAuth2",
  args: merge(
    globalArgs,
    args({
      scope,
    }),
  ),
  run: async (ctx) => {
    const clientId = process.env.WITHINGS_CLIENT_ID;
    const clientSecret = process.env.WITHINGS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new ConfigError(
        "Set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET environment variables.",
      );
    }

    const state = generateState();
    const authUrl = buildAuthorizationUrl({
      clientId,
      state,
      scope: ctx.values.scope ?? DEFAULT_SCOPE,
      redirectUri: DEFAULT_REDIRECT_URI,
    });

    console.log(colors.dim("Opening browser for authentication..."));
    console.log(`If the browser does not open, visit:\n${authUrl}\n`);

    const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
    Bun.spawn([openCmd, authUrl], { stdout: "ignore", stderr: "ignore" });

    const { code } = await waitForCallback(state);
    const tokenSet = await exchangeCodeForToken({
      clientId,
      clientSecret,
      code,
      redirectUri: DEFAULT_REDIRECT_URI,
    });

    const profile = profileName(ctx.values.profile);
    await tokenStoreForProfile(profile).save(tokenSet);

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

        // Keep waiting for the legitimate callback: a stray or forged request
        // (wrong state) must not be able to abort the login flow.
        if (returnedState !== expectedState) {
          return new Response("State mismatch. Request ignored.", { status: 400 });
        }

        if (!code) {
          const error =
            url.searchParams.get("error_description") ?? "No authorization code received";
          clearTimeout(timeout);
          void server.stop();
          reject(new Error(error));
          return new Response(`Authentication failed: ${error}`, { status: 400 });
        }

        clearTimeout(timeout);
        void server.stop();
        resolve({ code });
        return new Response("Authentication successful. You can close this tab.", {
          headers: { "Content-Type": "text/html" },
        });
      },
    });

    const timeout = setTimeout(() => {
      void server.stop();
      reject(new Error("Authentication timed out after 120 seconds."));
    }, 120_000);
  });
}
