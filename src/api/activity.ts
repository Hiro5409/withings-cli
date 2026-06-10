import { postWithingsForm } from "./client.ts";
import {
  hasMore,
  isObject,
  minutesFromSeconds,
  moreOrUndefined,
  numberOrUndefined,
  parseOffset,
  stringOrUndefined,
  type WithingsMore,
} from "./parse.ts";
import { assertWithingsOk } from "./withings-error.ts";

const ACTIVITY_DATA_FIELDS = [
  "steps",
  "distance",
  "soft",
  "moderate",
  "intense",
  "calories",
  "totalcalories",
  "hr_average",
].join(",");

export type ActivityQuery = {
  startdateymd?: string;
  enddateymd?: string;
  lastupdate?: number;
  limit?: number;
};

// Wire shapes for measurev2.getactivity, hand-written from the Withings API
// reference. Responses are parsed at the boundary and kept in `raw`.
export type NormalizedActivity = {
  date?: string;
  steps?: number;
  distanceM?: number;
  caloriesKcal?: number;
  totalCaloriesKcal?: number;
  softMin?: number;
  moderateMin?: number;
  intenseMin?: number;
  hrAverage?: number;
  raw: unknown;
};

type ActivityPage = {
  activities: unknown[];
  more?: WithingsMore;
  offset?: number;
  raw: unknown;
};

export function normalizeActivity(activity: unknown): NormalizedActivity {
  const fields = isObject(activity) ? activity : {};

  return {
    date: stringOrUndefined(fields.date),
    steps: numberOrUndefined(fields.steps),
    distanceM: numberOrUndefined(fields.distance),
    caloriesKcal: numberOrUndefined(fields.calories),
    totalCaloriesKcal: numberOrUndefined(fields.totalcalories),
    softMin: minutesFromSeconds(fields.soft),
    moderateMin: minutesFromSeconds(fields.moderate),
    intenseMin: minutesFromSeconds(fields.intense),
    hrAverage: numberOrUndefined(fields.hr_average),
    raw: activity,
  };
}

export function buildActivityForm(query: ActivityQuery, offset?: number): URLSearchParams {
  const form = new URLSearchParams({
    action: "getactivity",
    data_fields: ACTIVITY_DATA_FIELDS,
  });
  if (query.startdateymd !== undefined) form.set("startdateymd", query.startdateymd);
  if (query.enddateymd !== undefined) form.set("enddateymd", query.enddateymd);
  if (query.lastupdate !== undefined) form.set("lastupdate", String(query.lastupdate));
  if (offset !== undefined) form.set("offset", String(offset));
  return form;
}

export function parseActivityPage(value: unknown): ActivityPage {
  const root = isObject(value) ? value : {};
  assertWithingsOk(
    { status: numberOrUndefined(root.status), body: root.body },
    { service: "measurev2", action: "getactivity" },
  );

  const body = isObject(root.body) ? root.body : {};
  return {
    activities: Array.isArray(body.activities) ? body.activities : [],
    more: moreOrUndefined(body.more),
    offset: parseOffset(body.offset),
    raw: value,
  };
}

async function getActivityPage(params: {
  configDir: string;
  profile: string;
  query: ActivityQuery;
  offset?: number;
}): Promise<ActivityPage> {
  const response = await postWithingsForm({
    url: "https://wbsapi.withings.net/v2/measure",
    form: buildActivityForm(params.query, params.offset),
    configDir: params.configDir,
    profile: params.profile,
  });
  return parseActivityPage(response);
}

export async function fetchActivities(params: {
  configDir: string;
  profile: string;
  query: ActivityQuery;
}): Promise<{
  activities: NormalizedActivity[];
  pages: number;
  raw: unknown[];
}> {
  const rawPages: unknown[] = [];
  const activities: unknown[] = [];
  let offset: number | undefined;

  for (let page = 0; page < 100; page += 1) {
    const result = await getActivityPage({
      configDir: params.configDir,
      profile: params.profile,
      query: params.query,
      offset,
    });
    rawPages.push(result.raw);
    activities.push(...result.activities);

    if (params.query.limit && activities.length >= params.query.limit) break;
    if (!hasMore(result.more) || result.offset === undefined) break;
    offset = result.offset;
  }

  return {
    activities: activities.slice(0, params.query.limit).map(normalizeActivity),
    pages: rawPages.length,
    raw: rawPages,
  };
}
