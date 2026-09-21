import { args, combinator, integer } from "gunshi/combinators";
import { CliError } from "../errors.js";

const DEFAULT_RECENT_DAYS = 30;

type DateQueryValues = {
  startdateymd?: string;
  enddateymd?: string;
  lastupdate?: number;
  limit?: number;
};

export type CalendarDateQuery = {
  startdateymd?: string;
  enddateymd?: string;
  lastupdate?: number;
  limit: number;
};

export function parseUnixSeconds(value: string, name: string): number {
  if (!/^\d+$/.test(value)) {
    throw new CliError(`${name} must be a non-negative unix timestamp in seconds.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new CliError(`${name} must be a non-negative unix timestamp in seconds.`);
  }
  return parsed;
}

export function parseCalendarDate(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CliError(`${name} must be a calendar date in YYYY-MM-DD format.`);
  }

  const [yearText = "", monthText = "", dayText = ""] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const maxDay = new Date(year, month, 0).getDate();
  if (month < 1 || month > 12 || day < 1 || day > maxDay) {
    throw new CliError(`${name} must be a valid calendar date.`);
  }

  return value;
}

export function unixSecondsArg(name: string, description: string) {
  return combinator({
    description,
    parse: (value) => parseUnixSeconds(value, name),
  });
}

function calendarDateArg(name: string, description: string) {
  return combinator({
    description,
    parse: (value) => parseCalendarDate(value, name),
  });
}

export const calendarDateArgs = args({
  startdateymd: calendarDateArg("startdateymd", "Start date as YYYY-MM-DD"),
  enddateymd: calendarDateArg("enddateymd", "End date as YYYY-MM-DD"),
  lastupdate: unixSecondsArg(
    "lastupdate",
    "Only fetch data updated after this unix timestamp in seconds",
  ),
  limit: integer({ min: 1, description: "Maximum normalized rows to print (default: 30)" }),
});

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recentDateRange(
  days: number,
  now = new Date(),
): {
  startdateymd: string;
  enddateymd: string;
} {
  const end = new Date(now);
  const start = new Date(end);
  start.setDate(end.getDate() - days + 1);
  return {
    startdateymd: formatLocalDate(start),
    enddateymd: formatLocalDate(end),
  };
}

export function calendarDateQuery(
  values: DateQueryValues,
  options: { now?: Date } = {},
): CalendarDateQuery {
  const { startdateymd, enddateymd, lastupdate, limit = 30 } = values;

  if (lastupdate !== undefined && (startdateymd !== undefined || enddateymd !== undefined)) {
    throw new CliError("lastupdate cannot be combined with startdateymd or enddateymd.");
  }
  if ((startdateymd === undefined) !== (enddateymd === undefined)) {
    throw new CliError("startdateymd and enddateymd must be provided together.");
  }
  if (startdateymd !== undefined && enddateymd !== undefined && startdateymd > enddateymd) {
    throw new CliError("startdateymd must be earlier than or equal to enddateymd.");
  }
  if (lastupdate !== undefined) return { lastupdate, limit };
  if (startdateymd !== undefined && enddateymd !== undefined) {
    return { startdateymd, enddateymd, limit };
  }

  return { ...recentDateRange(DEFAULT_RECENT_DAYS, options.now), limit };
}
