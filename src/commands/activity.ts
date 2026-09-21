import { define } from "gunshi";
import { merge } from "gunshi/combinators";
import { fetchActivities } from "../api/activity.js";
import { globalArgs } from "../global-args.js";
import { printJson, printRows } from "../output.js";
import { calendarDateArgs, calendarDateQuery } from "./date-query.js";
import { tokenStoreForProfile } from "./token-store.js";

export const activityCommand = define({
  name: "activity",
  description: "List normalized daily activity summaries",
  args: merge(globalArgs, calendarDateArgs),
  run: async (ctx) => {
    const result = await fetchActivities({
      store: tokenStoreForProfile(ctx.values.profile),
      query: calendarDateQuery(ctx.values),
    });

    if (ctx.values.format === "json") {
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
