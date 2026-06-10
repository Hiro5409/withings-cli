import { expect, test } from "bun:test";
import { normalizeMeasureGroup } from "./measures.js";

test("normalizes tracked Withings body measure types", () => {
  const normalized = normalizeMeasureGroup({
    grpid: 123,
    date: 1_720_000_000,
    category: 1,
    measures: [
      { type: 1, value: 91234, unit: -3 },
      { type: 5, value: 650, unit: -1 },
      { type: 6, value: 2345, unit: -2 },
      { type: 8, value: 270, unit: -1 },
      { type: 76, value: 642, unit: -1 },
      { type: 77, value: 500, unit: -1 },
      { type: 88, value: 32, unit: -1 },
    ],
  });

  expect(normalized.weightKg).toBeCloseTo(91.234);
  expect(normalized.fatFreeMassKg).toBeCloseTo(65);
  expect(normalized.fatRatioPercent).toBeCloseTo(23.45);
  expect(normalized.fatMassKg).toBeCloseTo(27);
  expect(normalized.muscleMassKg).toBeCloseTo(64.2);
  expect(normalized.hydrationKg).toBeCloseTo(50);
  expect(normalized.boneMassKg).toBeCloseTo(3.2);
});
