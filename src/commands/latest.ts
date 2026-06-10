import { define } from "gunshi";
import { fetchLatestMeasure } from "../api/measures.ts";
import { configDir } from "../config/config.ts";
import { globalArgs } from "../global-args.ts";
import { outputFormat, printJson, printRows } from "../output.ts";

export const latestCommand = define({
  name: "latest",
  description: "Show the latest normalized body measure",
  args: globalArgs,
  run: async (ctx) => {
    const latest = await fetchLatestMeasure({
      configDir: configDir(),
      profile: String(ctx.values.profile ?? "default"),
    });

    if (outputFormat(ctx.values.format) === "json") {
      printJson({ latest });
      return;
    }

    if (!latest) {
      console.log("No measures found.");
      return;
    }

    printRows([
      {
        date: latest.date,
        weightKg: latest.weightKg,
        fatFreeMassKg: latest.fatFreeMassKg,
        fatRatioPercent: latest.fatRatioPercent,
        fatMassKg: latest.fatMassKg,
        muscleMassKg: latest.muscleMassKg,
        hydrationKg: latest.hydrationKg,
        boneMassKg: latest.boneMassKg,
      },
    ]);
  },
});
