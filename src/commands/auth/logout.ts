import { define } from "gunshi";
import colors from "yoctocolors";
import { removeProfile } from "../../api/auth.ts";
import { configDir } from "../../config/config.ts";
import { globalArgs } from "../../global-args.ts";
import { outputFormat, printMessage } from "../../output.ts";

export const logoutCommand = define({
  name: "logout",
  description: "Remove local credentials for a profile",
  args: globalArgs,
  run: (ctx) => {
    const profile = String(ctx.values.profile ?? "default");
    removeProfile(configDir(), profile);
    printMessage(
      colors.green(`Removed credentials for profile "${profile}".`),
      outputFormat(ctx.values.format),
      { ok: true, profile },
    );
  },
});
