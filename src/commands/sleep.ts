import { define } from "gunshi";
import { merge } from "gunshi/combinators";
import { fetchSleepSummaries } from "../api/sleep.js";
import { globalArgs } from "../global-args.js";
import { printJson, printRows } from "../output.js";
import { calendarDateArgs, calendarDateQuery } from "./date-query.js";
import { tokenStoreForProfile } from "./token-store.js";

export const sleepCommand = define({
  name: "sleep",
  description: "List normalized nightly sleep summaries",
  args: merge(globalArgs, calendarDateArgs),
  run: async (ctx) => {
    const result = await fetchSleepSummaries({
      store: tokenStoreForProfile(ctx.values.profile),
      query: calendarDateQuery(ctx.values),
    });

    if (ctx.values.format === "json") {
      printJson({ sleep: result.sleep, pages: result.pages });
      return;
    }

    printRows(
      result.sleep.map((sleep) => ({
        date: sleep.date,
        startdate: sleep.startdate,
        enddate: sleep.enddate,
        sleepScore: sleep.sleepScore,
        totalSleepTimeMin: sleep.totalSleepTimeMin,
        deepMin: sleep.deepMin,
        lightMin: sleep.lightMin,
        remMin: sleep.remMin,
        awakeMin: sleep.awakeMin,
        hrAverage: sleep.hrAverage,
      })),
    );
  },
});
