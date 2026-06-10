import { define } from "gunshi";
import { fetchMeasures, parseUnixSeconds } from "../api/measures.ts";
import { configDir } from "../config/config.ts";
import { globalArgs } from "../global-args.ts";
import { printJson } from "../output.ts";

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
