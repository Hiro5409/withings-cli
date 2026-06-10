import { define } from "gunshi";
import { fetchActivities } from "../api/activity.ts";
import { configDir } from "../config/config.ts";
import { globalArgs } from "../global-args.ts";
import { outputFormat, printJson, printRows } from "../output.ts";
import { calendarDateArgs, calendarDateQuery } from "./date-query.ts";

export const activityCommand = define({
  name: "activity",
  description: "List normalized daily activity summaries",
  args: {
    ...globalArgs,
    ...calendarDateArgs,
  },
  run: async (ctx) => {
    const result = await fetchActivities({
      configDir: configDir(),
      profile: String(ctx.values.profile ?? "default"),
      query: calendarDateQuery(ctx.values),
    });

    if (outputFormat(ctx.values.format) === "json") {
      printJson({ activities: result.activities, pages: result.pages });
      return;
    }

    printRows(
      result.activities.map((activity) => ({
        date: activity.date,
        steps: activity.steps,
        distanceM: activity.distanceM,
        caloriesKcal: activity.caloriesKcal,
        totalCaloriesKcal: activity.totalCaloriesKcal,
        softMin: activity.softMin,
        moderateMin: activity.moderateMin,
        intenseMin: activity.intenseMin,
        hrAverage: activity.hrAverage,
      })),
    );
  },
});
