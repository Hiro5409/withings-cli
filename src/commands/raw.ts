import { define } from "gunshi";
import {
  args,
  boolean,
  merge,
  multiple,
  positional,
  string,
  withDefault,
} from "gunshi/combinators";
import { callRawWithings, parseRawJson } from "../api/raw.js";
import { fetchMeasures } from "../api/measures.js";
import { unixSecondsArg } from "./date-query.js";
import { CliError } from "../errors.js";
import { globalArgs } from "../global-args.js";
import { printJson } from "../output.js";
import { tokenStoreForProfile } from "./token-store.js";

async function readStdinIfPiped(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;
  return (await Bun.stdin.text()).trim();
}

export const rawCommand = define({
  name: "raw",
  description: "Call raw Withings API endpoints",
  args: globalArgs,
  run: () => {
    console.log('Run "withings raw --help" for usage information.');
  },
});

export const rawCallCommand = define({
  name: "call",
  description: "Call a raw Withings API service/action",
  args: merge(
    globalArgs,
    args({
      params: multiple(
        positional(
          string({
            description:
              "service action [json]. Services: measure, measurev2, user, sleepv2, heart, stetho, notify",
          }),
        ),
      ),
      throw: withDefault(
        boolean({
          negatable: true,
          description: "Convert Withings status errors to CLI errors",
        }),
        true,
      ),
    }),
  ),
  run: async (ctx) => {
    const [service = "", action = "", ...jsonParts] = ctx.values.params ?? [];
    if (!service || !action) {
      throw new CliError("Missing raw service or action.", {
        exitCode: 3,
        code: "missing_argument",
        why: "The raw command requires both a Withings service and action.",
        hint: "Example: withings raw call user getdevice",
      });
    }

    const json = jsonParts.length > 0 ? jsonParts.join(" ") : ((await readStdinIfPiped()) ?? "");
    const response = await callRawWithings({
      store: tokenStoreForProfile(ctx.values.profile),
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
  args: merge(
    globalArgs,
    args({
      startdate: unixSecondsArg("startdate", "Start date as unix timestamp in seconds"),
      enddate: unixSecondsArg("enddate", "End date as unix timestamp in seconds"),
      lastupdate: unixSecondsArg(
        "lastupdate",
        "Only fetch data updated after this unix timestamp in seconds",
      ),
    }),
  ),
  run: async (ctx) => {
    const result = await fetchMeasures({
      store: tokenStoreForProfile(ctx.values.profile),
      query: {
        startdate: ctx.values.startdate,
        enddate: ctx.values.enddate,
        lastupdate: ctx.values.lastupdate,
      },
    });

    printJson({ pages: result.pages, raw: result.raw });
  },
});
