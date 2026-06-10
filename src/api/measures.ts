import { AuthError, CliError } from "../errors.ts";
import { measureGetmeas } from "../types/withings/sdk.gen.ts";
import type {
  MeasureGetmeasResponse,
  MeasureGetmeasResponses,
  MeasuregrpObject,
  MeasureObject,
} from "../types/withings/types.gen.ts";
import { authHeaders } from "./client.ts";

const TRACKED_MEASURE_TYPES = [1, 6, 76, 77, 88] as const;
const TRACKED_MEASURE_TYPES_PARAM = TRACKED_MEASURE_TYPES.join(",");

type MeasureQuery = {
  startdate?: number;
  enddate?: number;
  lastupdate?: number;
  limit?: number;
};

export type NormalizedMeasureGroup = {
  grpid?: number;
  date?: string;
  timestamp?: number;
  category?: number;
  attrib?: number;
  deviceid?: string;
  weightKg?: number;
  fatRatioPercent?: number;
  muscleMassKg?: number;
  hydrationKg?: number;
  boneMassKg?: number;
  raw: MeasuregrpObject;
};

function withingsValue(measure: MeasureObject): number | undefined {
  if (typeof measure.value !== "number" || typeof measure.unit !== "number") return undefined;
  return measure.value * 10 ** measure.unit;
}

function parseWithingsStatus(response: MeasureGetmeasResponse): void {
  if (response.status === 0 || response.status === undefined) return;
  throw new CliError(`Withings API returned status ${response.status}.`, {
    exitCode: 4,
    why: "The HTTP request succeeded, but the Withings API reported an application error.",
  });
}

function responseBody(
  response: MeasureGetmeasResponse,
): NonNullable<MeasureGetmeasResponse["body"]> {
  parseWithingsStatus(response);
  return response.body ?? {};
}

export function normalizeMeasureGroup(group: MeasuregrpObject): NormalizedMeasureGroup {
  const normalized: NormalizedMeasureGroup = {
    grpid: group.grpid,
    timestamp: group.date,
    date: typeof group.date === "number" ? new Date(group.date * 1000).toISOString() : undefined,
    category: group.category,
    attrib: group.attrib,
    deviceid: group.deviceid,
    raw: group,
  };

  for (const measure of group.measures ?? []) {
    const value = withingsValue(measure);
    if (value === undefined) continue;
    if (measure.type === 1) normalized.weightKg = value;
    if (measure.type === 6) normalized.fatRatioPercent = value;
    if (measure.type === 76) normalized.muscleMassKg = value;
    if (measure.type === 77) normalized.hydrationKg = value;
    if (measure.type === 88) normalized.boneMassKg = value;
  }

  return normalized;
}

async function getMeasuresPage(params: {
  configDir: string;
  profile: string;
  query: MeasureQuery;
  offset?: number;
}): Promise<MeasureGetmeasResponses[200]> {
  const headers = await authHeaders(params.configDir, params.profile);
  const result = await measureGetmeas({
    headers,
    query: {
      action: "getmeas",
      category: 1,
      meastypes: TRACKED_MEASURE_TYPES_PARAM,
      startdate: params.query.startdate,
      enddate: params.query.enddate,
      lastupdate: params.query.lastupdate,
      offset: params.offset,
    },
  });
  return result.data;
}

export async function fetchMeasures(params: {
  configDir: string;
  profile: string;
  query: MeasureQuery;
}): Promise<{
  measures: NormalizedMeasureGroup[];
  pages: number;
  raw: MeasureGetmeasResponses[200][];
}> {
  const rawPages: MeasureGetmeasResponses[200][] = [];
  const groups: MeasuregrpObject[] = [];
  let offset: number | undefined;

  for (let page = 0; page < 100; page += 1) {
    const response = await getMeasuresPage({
      configDir: params.configDir,
      profile: params.profile,
      query: params.query,
      offset,
    });
    rawPages.push(response);

    const body = responseBody(response);
    groups.push(...(body.measuregrps ?? []));

    if (params.query.limit && groups.length >= params.query.limit) break;
    if (body.more !== 1 || typeof body.offset !== "number") break;
    offset = body.offset;
  }

  return {
    measures: groups.slice(0, params.query.limit).map(normalizeMeasureGroup),
    pages: rawPages.length,
    raw: rawPages,
  };
}

export async function fetchLatestMeasure(params: {
  configDir: string;
  profile: string;
}): Promise<NormalizedMeasureGroup | undefined> {
  const result = await fetchMeasures({
    configDir: params.configDir,
    profile: params.profile,
    query: { limit: 1 },
  });
  return result.measures[0];
}

export function parseUnixSeconds(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CliError(`${name} must be a non-negative unix timestamp in seconds.`);
  }
  return parsed;
}

export function requireAuthenticated(error: unknown): never {
  if (error instanceof AuthError) throw error;
  throw error;
}
