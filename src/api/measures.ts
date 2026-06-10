import { postWithingsForm, type TokenStore } from "./client.js";
import {
  hasMore,
  isObject,
  moreOrUndefined,
  numberOrUndefined,
  parseOffset,
  stringOrUndefined,
  type WithingsMore,
} from "./parse.js";
import { assertWithingsOk } from "./withings-error.js";

const TRACKED_MEASURE_TYPES = [1, 5, 6, 8, 76, 77, 88] as const;
const TRACKED_MEASURE_TYPES_PARAM = TRACKED_MEASURE_TYPES.join(",");

export type MeasureQuery = {
  startdate?: number;
  enddate?: number;
  lastupdate?: number;
  limit?: number;
};

// Wire shapes for measure.getmeas, hand-written from the Withings API
// reference (https://developer.withings.com/api-reference/#tag/measure).
// Responses are parsed, never asserted: every field below is proven by a
// runtime check before use, and unrecognized data is kept in `raw`.
type MeasureValue = {
  type: number;
  value: number;
  unit: number;
};

export type NormalizedMeasureGroup = {
  grpid?: number;
  date?: string;
  timestamp?: number;
  category?: number;
  attrib?: number;
  deviceid?: string;
  weightKg?: number;
  fatFreeMassKg?: number;
  fatRatioPercent?: number;
  fatMassKg?: number;
  muscleMassKg?: number;
  hydrationKg?: number;
  boneMassKg?: number;
  raw: unknown;
};

function parseMeasureValue(value: unknown): MeasureValue | undefined {
  if (!isObject(value)) return undefined;
  if (
    typeof value.type !== "number" ||
    typeof value.value !== "number" ||
    typeof value.unit !== "number"
  ) {
    return undefined;
  }
  return { type: value.type, value: value.value, unit: value.unit };
}

export function normalizeMeasureGroup(group: unknown): NormalizedMeasureGroup {
  const fields = isObject(group) ? group : {};
  const timestamp = numberOrUndefined(fields.date);

  const normalized: NormalizedMeasureGroup = {
    grpid: numberOrUndefined(fields.grpid),
    timestamp,
    date: timestamp === undefined ? undefined : new Date(timestamp * 1000).toISOString(),
    category: numberOrUndefined(fields.category),
    attrib: numberOrUndefined(fields.attrib),
    deviceid: stringOrUndefined(fields.deviceid),
    raw: group,
  };

  const entries = Array.isArray(fields.measures) ? fields.measures : [];
  for (const entry of entries) {
    const measure = parseMeasureValue(entry);
    if (!measure) continue;
    const value = measure.value * 10 ** measure.unit;
    if (measure.type === 1) normalized.weightKg = value;
    if (measure.type === 5) normalized.fatFreeMassKg = value;
    if (measure.type === 6) normalized.fatRatioPercent = value;
    if (measure.type === 8) normalized.fatMassKg = value;
    if (measure.type === 76) normalized.muscleMassKg = value;
    if (measure.type === 77) normalized.hydrationKg = value;
    if (measure.type === 88) normalized.boneMassKg = value;
  }

  return normalized;
}

type GetmeasPage = {
  measuregrps: unknown[];
  more?: WithingsMore;
  offset?: number;
  raw: unknown;
};

function parseGetmeasPage(value: unknown): GetmeasPage {
  const root = isObject(value) ? value : {};
  assertWithingsOk(
    { status: numberOrUndefined(root.status), body: root.body },
    { service: "measure", action: "getmeas" },
  );

  const body = isObject(root.body) ? root.body : {};
  return {
    measuregrps: Array.isArray(body.measuregrps) ? body.measuregrps : [],
    more: moreOrUndefined(body.more),
    offset: parseOffset(body.offset),
    raw: value,
  };
}

async function getMeasuresPage(params: {
  store: TokenStore;
  query: MeasureQuery;
  offset?: number;
}): Promise<GetmeasPage> {
  const form = new URLSearchParams({
    action: "getmeas",
    category: "1",
    meastypes: TRACKED_MEASURE_TYPES_PARAM,
  });
  if (params.query.startdate !== undefined) form.set("startdate", String(params.query.startdate));
  if (params.query.enddate !== undefined) form.set("enddate", String(params.query.enddate));
  if (params.query.lastupdate !== undefined)
    form.set("lastupdate", String(params.query.lastupdate));
  if (params.offset !== undefined) form.set("offset", String(params.offset));

  const response = await postWithingsForm({
    url: "https://wbsapi.withings.net/measure",
    form,
    store: params.store,
  });
  return parseGetmeasPage(response);
}

export async function fetchMeasures(params: { store: TokenStore; query: MeasureQuery }): Promise<{
  measures: NormalizedMeasureGroup[];
  pages: number;
  raw: unknown[];
}> {
  const rawPages: unknown[] = [];
  const groups: unknown[] = [];
  let offset: number | undefined;

  for (let page = 0; page < 100; page += 1) {
    const result = await getMeasuresPage({
      store: params.store,
      query: params.query,
      offset,
    });
    rawPages.push(result.raw);
    groups.push(...result.measuregrps);

    if (params.query.limit && groups.length >= params.query.limit) break;
    if (!hasMore(result.more) || result.offset === undefined) break;
    offset = result.offset;
  }

  return {
    measures: groups.slice(0, params.query.limit).map(normalizeMeasureGroup),
    pages: rawPages.length,
    raw: rawPages,
  };
}

export async function fetchLatestMeasure(params: {
  store: TokenStore;
}): Promise<NormalizedMeasureGroup | undefined> {
  const result = await fetchMeasures({
    store: params.store,
    query: { limit: 1 },
  });
  return result.measures[0];
}
