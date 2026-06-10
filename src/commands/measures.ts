import { define } from "gunshi";
import { fetchMeasures } from "../api/measures.js";
import { globalArgs } from "../global-args.js";
import { outputFormat, printJson, printRows } from "../output.js";
import { parseUnixSeconds } from "./date-query.js";
import { tokenStoreForProfile } from "./token-store.js";

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
    const profile = String(ctx.values.profile ?? "default");
    const result = await fetchMeasures({
      store: tokenStoreForProfile(profile),
      query: {
        startdate: parseUnixSeconds(ctx.values.startdate, "startdate"),
        enddate: parseUnixSeconds(ctx.values.enddate, "enddate"),
        lastupdate: parseUnixSeconds(ctx.values.lastupdate, "lastupdate"),
        limit: Number(ctx.values.limit ?? 30),
      },
    });

    if (outputFormat(ctx.values.format) === "json") {
      printJson({ measures: result.measures, pages: result.pages });
      return;
    }

    printRows(
      result.measures.map((measure) => ({
        date: measure.date,
        weightKg: measure.weightKg,
        fatFreeMassKg: measure.fatFreeMassKg,
        fatRatioPercent: measure.fatRatioPercent,
        fatMassKg: measure.fatMassKg,
        muscleMassKg: measure.muscleMassKg,
        hydrationKg: measure.hydrationKg,
        boneMassKg: measure.boneMassKg,
      })),
    );
  },
});
