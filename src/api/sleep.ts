import { postWithingsForm, type TokenStore } from "./client.js";
import {
  hasMore,
  isoFromUnixSeconds,
  isObject,
  minutesFromSeconds,
  moreOrUndefined,
  numberOrUndefined,
  parseOffset,
  stringOrUndefined,
  type WithingsMore,
} from "./parse.js";
import { assertWithingsOk } from "./withings-error.js";

const SLEEP_DATA_FIELDS = [
  "total_sleep_time",
  "asleepduration",
  "lightsleepduration",
  "remsleepduration",
  "deepsleepduration",
  "wakeupduration",
  "hr_average",
  "sleep_score",
].join(",");

export type SleepQuery = {
  startdateymd?: string;
  enddateymd?: string;
  lastupdate?: number;
  limit?: number;
};

// Wire shapes for sleepv2.getsummary, hand-written from the Withings API
// reference. The minute-level sleepv2.get endpoint is intentionally separate.
export type NormalizedSleepSummary = {
  date?: string;
  startdate?: string;
  enddate?: string;
  sleepScore?: number;
  totalSleepTimeMin?: number;
  deepMin?: number;
  lightMin?: number;
  remMin?: number;
  awakeMin?: number;
  hrAverage?: number;
  raw: unknown;
};

type SleepPage = {
  series: unknown[];
  more?: WithingsMore;
  offset?: number;
  raw: unknown;
};

export function normalizeSleepSummary(summary: unknown): NormalizedSleepSummary {
  const fields = isObject(summary) ? summary : {};
  const data = isObject(fields.data) ? fields.data : {};
  const totalSleepTime = data.total_sleep_time ?? data.asleepduration;

  return {
    date: stringOrUndefined(fields.date),
    startdate: isoFromUnixSeconds(fields.startdate),
    enddate: isoFromUnixSeconds(fields.enddate),
    sleepScore: numberOrUndefined(data.sleep_score),
    totalSleepTimeMin: minutesFromSeconds(totalSleepTime),
    deepMin: minutesFromSeconds(data.deepsleepduration),
    lightMin: minutesFromSeconds(data.lightsleepduration),
    remMin: minutesFromSeconds(data.remsleepduration),
    awakeMin: minutesFromSeconds(data.wakeupduration),
    hrAverage: numberOrUndefined(data.hr_average),
    raw: summary,
  };
}

export function buildSleepForm(query: SleepQuery, offset?: number): URLSearchParams {
  const form = new URLSearchParams({
    action: "getsummary",
    data_fields: SLEEP_DATA_FIELDS,
  });
  if (query.startdateymd !== undefined) form.set("startdateymd", query.startdateymd);
  if (query.enddateymd !== undefined) form.set("enddateymd", query.enddateymd);
  if (query.lastupdate !== undefined) form.set("lastupdate", String(query.lastupdate));
  if (offset !== undefined) form.set("offset", String(offset));
  return form;
}

export function parseSleepPage(value: unknown): SleepPage {
  const root = isObject(value) ? value : {};
  assertWithingsOk(
    { status: numberOrUndefined(root.status), body: root.body },
    { service: "sleepv2", action: "getsummary" },
  );

  const body = isObject(root.body) ? root.body : {};
  return {
    series: Array.isArray(body.series) ? body.series : [],
    more: moreOrUndefined(body.more),
    offset: parseOffset(body.offset),
    raw: value,
  };
}

async function getSleepPage(params: {
  store: TokenStore;
  query: SleepQuery;
  offset?: number;
}): Promise<SleepPage> {
  const response = await postWithingsForm({
    url: "https://wbsapi.withings.net/v2/sleep",
    form: buildSleepForm(params.query, params.offset),
    store: params.store,
  });
  return parseSleepPage(response);
}

export async function fetchSleepSummaries(params: {
  store: TokenStore;
  query: SleepQuery;
}): Promise<{
  sleep: NormalizedSleepSummary[];
  pages: number;
  raw: unknown[];
}> {
  const rawPages: unknown[] = [];
  const series: unknown[] = [];
  let offset: number | undefined;

  for (let page = 0; page < 100; page += 1) {
    const result = await getSleepPage({
      store: params.store,
      query: params.query,
      offset,
    });
    rawPages.push(result.raw);
    series.push(...result.series);

    if (params.query.limit && series.length >= params.query.limit) break;
    if (!hasMore(result.more) || result.offset === undefined) break;
    offset = result.offset;
  }

  return {
    sleep: series.slice(0, params.query.limit).map(normalizeSleepSummary),
    pages: rawPages.length,
    raw: rawPages,
  };
}
