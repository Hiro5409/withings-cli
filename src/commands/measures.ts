import { define } from "gunshi";
import { fetchMeasures, parseUnixSeconds } from "../api/measures.ts";
import { configDir } from "../config/config.ts";
import { globalArgs } from "../global-args.ts";
import { outputFormat, printJson, printRows } from "../output.ts";

const measureArgs = {
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
  limit: {
    type: "number" as const,
    description: "Maximum normalized measure groups to print",
    default: 30,
  },
};

export const measuresCommand = define({
  name: "measures",
  description: "List normalized body measures",
  args: measureArgs,
  run: async (ctx) => {
    const result = await fetchMeasures({
      configDir: configDir(),
      profile: String(ctx.values.profile ?? "default"),
      query: {
        startdate: parseUnixSeconds(ctx.values.startdate, "startdate"),
        enddate: parseUnixSeconds(ctx.values.enddate, "enddate"),
        lastupdate: parseUnixSeconds(ctx.values.lastupdate, "lastupdate"),
        limit: Number(ctx.values.limit ?? 30),
      },
    });

    if (outputFormat(ctx.values.format) === "json") {
      printJson(result);
      return;
    }

    printRows(
      result.measures.map((measure) => ({
        date: measure.date,
        weightKg: measure.weightKg,
        fatRatioPercent: measure.fatRatioPercent,
        muscleMassKg: measure.muscleMassKg,
        hydrationKg: measure.hydrationKg,
        boneMassKg: measure.boneMassKg,
      })),
    );
  },
});
