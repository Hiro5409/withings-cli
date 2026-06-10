import { define } from "gunshi";
import { fetchSleepSummaries } from "../api/sleep.ts";
import { configDir } from "../config/config.ts";
import { globalArgs } from "../global-args.ts";
import { outputFormat, printJson, printRows } from "../output.ts";
import { calendarDateArgs, calendarDateQuery } from "./date-query.ts";

export const sleepCommand = define({
  name: "sleep",
  description: "List normalized nightly sleep summaries",
  args: {
    ...globalArgs,
    ...calendarDateArgs,
  },
  run: async (ctx) => {
    const result = await fetchSleepSummaries({
      configDir: configDir(),
      profile: String(ctx.values.profile ?? "default"),
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
