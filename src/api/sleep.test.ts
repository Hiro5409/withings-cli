import { expect, test } from "bun:test";
import { buildSleepForm, normalizeSleepSummary, parseSleepPage } from "./sleep.ts";

test("normalizes nightly sleep summary fields", () => {
  const normalized = normalizeSleepSummary({
    date: "2026-06-10",
    startdate: 1_781_042_400,
    enddate: 1_781_071_200,
    data: {
      sleep_score: 82,
      total_sleep_time: 25_200,
      deepsleepduration: 5_400,
      lightsleepduration: 12_600,
      remsleepduration: 7_200,
      wakeupduration: 1_800,
      hr_average: 58,
    },
  });

  expect(normalized.date).toBe("2026-06-10");
  expect(normalized.startdate).toBe("2026-06-09T22:00:00.000Z");
  expect(normalized.enddate).toBe("2026-06-10T06:00:00.000Z");
  expect(normalized.sleepScore).toBe(82);
  expect(normalized.totalSleepTimeMin).toBe(420);
  expect(normalized.deepMin).toBe(90);
  expect(normalized.lightMin).toBe(210);
  expect(normalized.remMin).toBe(120);
  expect(normalized.awakeMin).toBe(30);
  expect(normalized.hrAverage).toBe(58);
});

test("builds getsummary form with requested sleep fields", () => {
  const form = buildSleepForm(
    {
      startdateymd: "2026-06-01",
      enddateymd: "2026-06-10",
    },
    200,
  );

  expect(form.get("action")).toBe("getsummary");
  expect(form.get("startdateymd")).toBe("2026-06-01");
  expect(form.get("enddateymd")).toBe("2026-06-10");
  expect(form.get("offset")).toBe("200");
  expect(form.get("data_fields")).toContain("total_sleep_time");
  expect(form.get("data_fields")).toContain("asleepduration");
  expect(form.get("data_fields")).toContain("sleep_score");
  expect(form.get("data_fields")).toContain("hr_average");
});

test("parses getsummary pagination metadata", () => {
  const page = parseSleepPage({
    status: 0,
    body: {
      series: [{ date: "2026-06-10" }],
      more: 1,
      offset: "400",
    },
  });

  expect(page.series).toHaveLength(1);
  expect(page.more).toBe(1);
  expect(page.offset).toBe(400);
});

test("falls back to asleepduration for external-source sleep summaries", () => {
  const normalized = normalizeSleepSummary({
    date: "2026-06-10",
    data: {
      asleepduration: 21_600,
    },
  });

  expect(normalized.totalSleepTimeMin).toBe(360);
});
