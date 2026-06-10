import { define } from "gunshi";
import colors from "yoctocolors";
import { configDir } from "../../config/config.js";
import { globalArgs } from "../../global-args.js";
import { outputFormat, printMessage } from "../../output.js";
import { removeProfile } from "../../stores/file.js";

export const logoutCommand = define({
  name: "logout",
  description: "Remove local credentials for a profile",
  args: globalArgs,
  run: async (ctx) => {
    const profile = String(ctx.values.profile ?? "default");
    await removeProfile(configDir(), profile);
    printMessage(
      colors.green(`Removed credentials for profile "${profile}".`),
      outputFormat(ctx.values.format),
      { ok: true, profile },
    );
  },
});
