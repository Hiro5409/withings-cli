import { define } from "gunshi";
import { fetchLatestMeasure } from "../api/measures.js";
import { globalArgs } from "../global-args.js";
import { printJson, printRows } from "../output.js";
import { tokenStoreForProfile } from "./token-store.js";

export const latestCommand = define({
  name: "latest",
  description: "Show the latest normalized body measure",
  args: globalArgs,
  run: async (ctx) => {
    const latest = await fetchLatestMeasure({
      store: tokenStoreForProfile(ctx.values.profile),
    });

    if (ctx.values.format === "json") {
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
