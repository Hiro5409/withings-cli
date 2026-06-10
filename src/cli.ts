import { cli, define } from "gunshi";
import { renderHeader } from "gunshi/renderer";
import { loginCommand } from "./commands/auth/login.js";
import { logoutCommand } from "./commands/auth/logout.js";
import { statusCommand } from "./commands/auth/status.js";
import { activityCommand } from "./commands/activity.js";
import { latestCommand } from "./commands/latest.js";
import { measuresCommand } from "./commands/measures.js";
import { notifyCommand } from "./commands/notify.js";
import { rawCommand, rawMeasureGetmeasCommand } from "./commands/raw.js";
import { sleepCommand } from "./commands/sleep.js";
import { printError } from "./error-output.js";
import { globalArgs } from "./global-args.js";

const rootCommand = define({
  name: "withings",
  description: "Thin local-first CLI for the Withings Public API.",
  args: globalArgs,
  run: () => {
    console.log('Run "withings --help" for usage information.');
  },
});

export async function main() {
  const pkg = await import("../package.json", { with: { type: "json" } });

  await cli(process.argv.slice(2), rootCommand, {
    name: "withings",
    version: pkg.default.version,
    subCommands: {
      login: loginCommand,
      logout: logoutCommand,
      status: statusCommand,
      measures: measuresCommand,
      latest: latestCommand,
      activity: activityCommand,
      sleep: sleepCommand,
      notify: notifyCommand,
      raw: define({
        ...rawCommand,
        subCommands: {
          "measure-getmeas": rawMeasureGetmeasCommand,
        },
      }),
    },
    renderHeader: (ctx) => {
      if (ctx.values.format === "json" && !ctx.values.help && !ctx.values.version) {
        return Promise.resolve("");
      }
      return renderHeader(ctx);
    },
    onErrorCommand: (ctx, error) => {
      printError(error, String(ctx.values.format ?? "table"));
    },
  });
}
