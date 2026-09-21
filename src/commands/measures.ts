import { define } from "gunshi";
import { args, integer, merge } from "gunshi/combinators";
import { fetchMeasures } from "../api/measures.js";
import { globalArgs } from "../global-args.js";
import { printJson, printRows } from "../output.js";
import { unixSecondsArg } from "./date-query.js";
import { tokenStoreForProfile } from "./token-store.js";

const measureArgs = merge(
  globalArgs,
  args({
    startdate: unixSecondsArg("startdate", "Start date as unix timestamp in seconds"),
    enddate: unixSecondsArg("enddate", "End date as unix timestamp in seconds"),
    lastupdate: unixSecondsArg(
      "lastupdate",
      "Only fetch data updated after this unix timestamp in seconds",
    ),
    limit: integer({
      min: 1,
      description: "Maximum normalized measure groups to print (default: 30)",
    }),
  }),
);

export const measuresCommand = define({
  name: "measures",
  description: "List normalized body measures",
  args: measureArgs,
  run: async (ctx) => {
    const result = await fetchMeasures({
      store: tokenStoreForProfile(ctx.values.profile),
      query: {
        startdate: ctx.values.startdate,
        enddate: ctx.values.enddate,
        lastupdate: ctx.values.lastupdate,
        limit: ctx.values.limit ?? 30,
      },
    });

    if (ctx.values.format === "json") {
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
