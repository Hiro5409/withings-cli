import { define } from "gunshi";
import colors from "yoctocolors";
import { getTokenStatus } from "../../api/auth.js";
import { configDir } from "../../config/config.js";
import { globalArgs } from "../../global-args.js";
import { printJson } from "../../output.js";
import { FileTokenStore } from "../../stores/file.js";
import { profileName } from "../token-store.js";

export const statusCommand = define({
  name: "status",
  description: "Show local authentication status",
  args: globalArgs,
  run: async (ctx) => {
    const { format } = ctx.values;
    const profile = profileName(ctx.values.profile);
    const dir = configDir();
    const tokenSet = await new FileTokenStore({ configDir: dir, profile }).load();

    if (!tokenSet) {
      const payload = {
        authenticated: false,
        profile,
        configDir: dir,
        credentialsPath: `${dir}/credentials.json`,
      };
      if (format === "json") printJson(payload);
      else console.log(colors.yellow(`Not authenticated for profile "${profile}".`));
      return;
    }

    const tokenStatus = getTokenStatus(tokenSet);
    const payload = {
      authenticated: true,
      profile,
      configDir: dir,
      expiresAt: tokenStatus.expiresAt.toISOString(),
      isValid: tokenStatus.isValid,
      scope: tokenSet.scope,
    };

    if (format === "json") printJson(payload);
    else {
      console.log(`Authenticated as profile "${profile}".`);
      console.log(`Token valid: ${tokenStatus.isValid ? "yes" : "no"}`);
      console.log(`Expires at: ${tokenStatus.expiresAt.toISOString()}`);
    }
  },
});
