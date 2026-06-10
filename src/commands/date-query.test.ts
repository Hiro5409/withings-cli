import { expect, test } from "bun:test";
import { CliError } from "../errors.js";
import { calendarDateQuery, parseUnixSeconds } from "./date-query.js";

test("builds an explicit calendar date query", () => {
  expect(
    calendarDateQuery({
      startdateymd: "2026-06-01",
      enddateymd: "2026-06-10",
      limit: 7,
    }),
  ).toEqual({
    startdateymd: "2026-06-01",
    enddateymd: "2026-06-10",
    limit: 7,
  });
});

test("uses a fixed default recent window independent of limit", () => {
  expect(
    calendarDateQuery(
      {
        limit: 7,
      },
      { now: new Date(2026, 5, 10, 12) },
    ),
  ).toEqual({
    startdateymd: "2026-05-12",
    enddateymd: "2026-06-10",
    limit: 7,
  });
});

test("rejects incomplete date ranges", () => {
  expect(() => calendarDateQuery({ startdateymd: "2026-06-01" })).toThrow(CliError);
  expect(() => calendarDateQuery({ enddateymd: "2026-06-10" })).toThrow(CliError);
});

test("rejects lastupdate combined with date ranges", () => {
  expect(() =>
    calendarDateQuery({
      startdateymd: "2026-06-01",
      enddateymd: "2026-06-10",
      lastupdate: 1_720_000_000,
    }),
  ).toThrow(CliError);
});

test("rejects invalid dates and reversed ranges", () => {
  expect(() =>
    calendarDateQuery({
      startdateymd: "2026-02-30",
      enddateymd: "2026-03-01",
    }),
  ).toThrow(CliError);
  expect(() =>
    calendarDateQuery({
      startdateymd: "2026-06-10",
      enddateymd: "2026-06-01",
    }),
  ).toThrow(CliError);
});

test("rejects invalid limits and unix timestamps", () => {
  expect(() => calendarDateQuery({ limit: 0 })).toThrow(CliError);
  expect(() => parseUnixSeconds("-1", "lastupdate")).toThrow(CliError);
});
