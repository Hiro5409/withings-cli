import { define } from "gunshi";
import { fetchSleepSummaries } from "../api/sleep.js";
import { globalArgs } from "../global-args.js";
import { outputFormat, printJson, printRows } from "../output.js";
import { calendarDateArgs, calendarDateQuery } from "./date-query.js";
import { tokenStoreForProfile } from "./token-store.js";

export const sleepCommand = define({
  name: "sleep",
  description: "List normalized nightly sleep summaries",
  args: {
    ...globalArgs,
    ...calendarDateArgs,
  },
  run: async (ctx) => {
    const profile = String(ctx.values.profile ?? "default");
    const result = await fetchSleepSummaries({
      store: tokenStoreForProfile(profile),
      query: calendarDateQuery(ctx.values),
    });

    if (outputFormat(ctx.values.format) === "json") {
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
