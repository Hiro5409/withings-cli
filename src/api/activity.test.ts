import { expect, test } from "bun:test";
import { buildActivityForm, normalizeActivity, parseActivityPage } from "./activity.js";

test("normalizes daily activity fields", () => {
  const normalized = normalizeActivity({
    date: "2026-06-10",
    steps: 8123,
    distance: 6234.5,
    calories: 450,
    totalcalories: 2450,
    soft: 1800,
    moderate: 2400,
    intense: 600,
    hr_average: 72,
    elevation: 12,
  });

  expect(normalized.date).toBe("2026-06-10");
  expect(normalized.steps).toBe(8123);
  expect(normalized.distanceM).toBe(6234.5);
  expect(normalized.caloriesKcal).toBe(450);
  expect(normalized.totalCaloriesKcal).toBe(2450);
  expect(normalized.softMin).toBe(30);
  expect(normalized.moderateMin).toBe(40);
  expect(normalized.intenseMin).toBe(10);
  expect(normalized.hrAverage).toBe(72);
});

test("builds getactivity form with requested summary fields", () => {
  const form = buildActivityForm(
    {
      startdateymd: "2026-06-01",
      enddateymd: "2026-06-10",
    },
    200,
  );

  expect(form.get("action")).toBe("getactivity");
  expect(form.get("startdateymd")).toBe("2026-06-01");
  expect(form.get("enddateymd")).toBe("2026-06-10");
  expect(form.get("offset")).toBe("200");
  expect(form.get("data_fields")).toContain("steps");
  expect(form.get("data_fields")).toContain("hr_average");
});

test("parses getactivity pagination metadata", () => {
  const page = parseActivityPage({
    status: 0,
    body: {
      activities: [{ date: "2026-06-10" }],
      more: true,
      offset: "400",
    },
  });

  expect(page.activities).toHaveLength(1);
  expect(page.more).toBe(true);
  expect(page.offset).toBe(400);
});
