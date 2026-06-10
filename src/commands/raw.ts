import { define } from "gunshi";
import { callRawWithings, parseRawJson } from "../api/raw.ts";
import { fetchMeasures } from "../api/measures.ts";
import { configDir } from "../config/config.ts";
import { parseUnixSeconds } from "./date-query.ts";
import { CliError } from "../errors.ts";
import { globalArgs } from "../global-args.ts";
import { printJson } from "../output.ts";

async function readStdinIfPiped(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;
  return (await Bun.stdin.text()).trim();
}

export const rawCommand = define({
  name: "raw",
  description: "Call a raw Withings API service/action",
  args: {
    ...globalArgs,
    params: {
      type: "positional" as const,
      multiple: true,
      description:
        "service action [json]. Services: measure, measurev2, user, sleepv2, heart, stetho, notify",
    },
    throw: {
      type: "boolean" as const,
      negatable: true,
      description: "Convert Withings status errors to CLI errors",
      default: true,
    },
  },
  run: async (ctx) => {
    const params = Array.isArray(ctx.values.params) ? ctx.values.params.map(String) : [];
    const [service = "", action = "", ...jsonParts] = params;
    if (!service || !action) {
      throw new CliError("Missing raw service or action.", {
        exitCode: 3,
        code: "missing_argument",
        why: "The raw command requires both a Withings service and action.",
        hint: "Example: withings raw user getdevice",
      });
    }

    const json = jsonParts.length > 0 ? jsonParts.join(" ") : ((await readStdinIfPiped()) ?? "");
    const response = await callRawWithings({
      configDir: configDir(),
      profile: String(ctx.values.profile ?? "default"),
      service,
      action,
      fields: parseRawJson(json),
      throwOnStatus: ctx.values.throw,
    });
    printJson(response);
  },
});

export const rawMeasureGetmeasCommand = define({
  name: "measure-getmeas",
  description: "Call measure-getmeas and print raw Withings responses",
  args: {
    ...globalArgs,
    startdate: {
      type: "string" as const,
      description: "Start date as unix timestamp seconds",
    },
    enddate: {
      type: "string" as const,
      description: "End date as unix timestamp seconds",
    },
    lastupdate: {
      type: "string" as const,
      description: "Only fetch data updated after this unix timestamp seconds",
    },
  },
  run: async (ctx) => {
    const result = await fetchMeasures({
      configDir: configDir(),
      profile: String(ctx.values.profile ?? "default"),
      query: {
        startdate: parseUnixSeconds(ctx.values.startdate, "startdate"),
        enddate: parseUnixSeconds(ctx.values.enddate, "enddate"),
        lastupdate: parseUnixSeconds(ctx.values.lastupdate, "lastupdate"),
      },
    });

    printJson({ pages: result.pages, raw: result.raw });
  },
});
