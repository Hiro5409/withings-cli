import { expect, test } from "bun:test";
import { hasMore, isoFromUnixSeconds, minutesFromSeconds, parseOffset } from "./parse.js";

test("parses Withings pagination offsets", () => {
  expect(parseOffset(200)).toBe(200);
  expect(parseOffset("400")).toBe(400);
  expect(parseOffset("4.5")).toBeUndefined();
  expect(parseOffset("abc")).toBeUndefined();
});

test("normalizes Withings more flags", () => {
  expect(hasMore(true)).toBe(true);
  expect(hasMore(1)).toBe(true);
  expect(hasMore(false)).toBe(false);
  expect(hasMore(0)).toBe(false);
  expect(hasMore("1")).toBe(false);
});

test("converts common Withings scalar values", () => {
  expect(minutesFromSeconds(1800)).toBe(30);
  expect(minutesFromSeconds("1800")).toBeUndefined();
  expect(isoFromUnixSeconds(1_781_042_400)).toBe("2026-06-09T22:00:00.000Z");
});
