import { define } from "gunshi";
import colors from "yoctocolors";
import { getTokenStatus } from "../../api/auth.js";
import { configDir } from "../../config/config.js";
import { globalArgs } from "../../global-args.js";
import { outputFormat, printJson } from "../../output.js";
import { FileTokenStore } from "../../stores/file.js";

export const statusCommand = define({
  name: "status",
  description: "Show local authentication status",
  args: globalArgs,
  run: async (ctx) => {
    const format = outputFormat(ctx.values.format);
    const profile = String(ctx.values.profile ?? "default");
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
