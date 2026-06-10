import { cli, define } from "gunshi";
import { renderHeader } from "gunshi/renderer";
import { loginCommand } from "./commands/auth/login.ts";
import { logoutCommand } from "./commands/auth/logout.ts";
import { statusCommand } from "./commands/auth/status.ts";
import { activityCommand } from "./commands/activity.ts";
import { latestCommand } from "./commands/latest.ts";
import { measuresCommand } from "./commands/measures.ts";
import { notifyCommand } from "./commands/notify.ts";
import { rawCommand, rawMeasureGetmeasCommand } from "./commands/raw.ts";
import { sleepCommand } from "./commands/sleep.ts";
import { printError } from "./error-output.ts";
import { globalArgs } from "./global-args.ts";

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
