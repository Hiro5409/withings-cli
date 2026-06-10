import { CliError } from "../errors.js";

const DEFAULT_RECENT_DAYS = 30;

type DateQueryValues = {
  startdateymd?: unknown;
  enddateymd?: unknown;
  lastupdate?: unknown;
  limit?: unknown;
};

export type CalendarDateQuery = {
  startdateymd?: string;
  enddateymd?: string;
  lastupdate?: number;
  limit: number;
};

export const calendarDateArgs = {
  startdateymd: {
    type: "string" as const,
    description: "Start date as YYYY-MM-DD",
  },
  enddateymd: {
    type: "string" as const,
    description: "End date as YYYY-MM-DD",
  },
  lastupdate: {
    type: "string" as const,
    description: "Only fetch data updated after this unix timestamp seconds",
  },
  limit: {
    type: "number" as const,
    description: "Maximum normalized rows to print",
    default: 30,
  },
};

function parseLimit(value: unknown): number {
  const parsed = Number(value ?? 30);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError("limit must be a positive integer.");
  }
  return parsed;
}

export function parseUnixSeconds(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CliError(`${name} must be a non-negative unix timestamp in seconds.`);
  }
  return parsed;
}

function parseDateYmd(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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
  const limit = parseLimit(values.limit);
  const startdateymd = parseDateYmd(values.startdateymd, "startdateymd");
  const enddateymd = parseDateYmd(values.enddateymd, "enddateymd");
  const lastupdate = parseUnixSeconds(values.lastupdate, "lastupdate");

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
