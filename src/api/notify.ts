import { postWithingsForm, type TokenStore } from "./client.js";
import { isObject, numberOrUndefined, stringOrUndefined } from "./parse.js";
import { assertWithingsOk } from "./withings-error.js";

const NOTIFY_URL = "https://wbsapi.withings.net/notify";

// Notification categories ("appli") relevant to consumer health data. Full
// list: https://developer.withings.com/developer-guide/v3/data-api/notifications/notification-overview/
export const KNOWN_APPLI =
  "1=weight/body composition, 4=heart/blood pressure, 16=activity, 44=sleep";

export type NotifySubscription = {
  appli?: number;
  callbackurl?: string;
  comment?: string;
  expires?: number;
  raw: unknown;
};

type NotificationPayloadEntries = {
  entries: () => Iterable<readonly [unknown, unknown]>;
};

export type WithingsNotification = {
  appli: number;
  // Some categories, for example unassociated device setup (appli=53), do not
  // include a userid.
  userid?: number;
  startdate?: number;
  enddate?: number;
  date?: number | string;
  deviceid?: string;
  mac?: string;
  action?: string;
  // Form fields after scalar values have been converted to strings.
  fields: Record<string, string>;
};

function scalarString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function hasPayloadEntries(input: unknown): input is NotificationPayloadEntries {
  return isObject(input) && typeof input.entries === "function";
}

function payloadFields(input: unknown): Record<string, string> {
  const fields: Record<string, string> = {};

  if (hasPayloadEntries(input)) {
    for (const [key, value] of input.entries()) {
      const fieldName = scalarString(key);
      const fieldValue = scalarString(value);
      if (fieldName !== undefined && fieldValue !== undefined) fields[fieldName] = fieldValue;
    }
    return fields;
  }

  if (isObject(input)) {
    for (const [key, value] of Object.entries(input)) {
      const text = scalarString(value);
      if (text !== undefined) fields[key] = text;
    }
  }
  return fields;
}

function parseRequiredInteger(fields: Record<string, string>, name: string): number {
  const value = fields[name];
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`Invalid Withings notification payload: ${name} must be an integer.`);
  }
  return Number(value);
}

function parseOptionalInteger(fields: Record<string, string>, name: string): number | undefined {
  const value = fields[name];
  if (value === undefined || value === "") return undefined;
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid Withings notification payload: ${name} must be an integer.`);
  }
  return Number(value);
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const [, year, month, day] = match;
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toISOString().slice(0, 10) === value;
}

function parseOptionalDate(fields: Record<string, string>): number | string | undefined {
  const value = fields.date;
  if (value === undefined || value === "") return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  if (isCalendarDate(value)) return value;
  throw new Error("Invalid Withings notification payload: date must be YYYY-MM-DD or unix time.");
}

export function parseNotificationPayload(input: unknown): WithingsNotification {
  const fields = payloadFields(input);
  return {
    appli: parseRequiredInteger(fields, "appli"),
    userid: parseOptionalInteger(fields, "userid"),
    startdate: parseOptionalInteger(fields, "startdate"),
    enddate: parseOptionalInteger(fields, "enddate"),
    date: parseOptionalDate(fields),
    deviceid: fields.deviceid,
    mac: fields.mac,
    action: fields.action,
    fields,
  };
}

function parseSubscription(value: unknown): NotifySubscription {
  const fields = isObject(value) ? value : {};
  return {
    appli: numberOrUndefined(fields.appli),
    callbackurl: stringOrUndefined(fields.callbackurl),
    comment: stringOrUndefined(fields.comment),
    expires: numberOrUndefined(fields.expires),
    raw: value,
  };
}

async function callNotify(params: {
  store: TokenStore;
  action: string;
  fields: Record<string, string>;
}): Promise<Record<string, unknown>> {
  const response = await postWithingsForm({
    url: NOTIFY_URL,
    form: new URLSearchParams({ action: params.action, ...params.fields }),
    store: params.store,
  });
  const root = isObject(response) ? response : {};
  assertWithingsOk(
    { status: numberOrUndefined(root.status), body: root.body },
    { service: "notify", action: params.action },
  );
  return root;
}

export async function listNotifications(params: {
  store: TokenStore;
  appli?: number;
}): Promise<NotifySubscription[]> {
  const root = await callNotify({
    store: params.store,
    action: "list",
    fields: params.appli === undefined ? {} : { appli: String(params.appli) },
  });
  const body = isObject(root.body) ? root.body : {};
  const profiles = Array.isArray(body.profiles) ? body.profiles : [];
  return profiles.map(parseSubscription);
}

export async function subscribeNotification(params: {
  store: TokenStore;
  callbackurl: string;
  appli: number;
  comment?: string;
}): Promise<void> {
  await callNotify({
    store: params.store,
    action: "subscribe",
    fields: {
      callbackurl: params.callbackurl,
      appli: String(params.appli),
      ...(params.comment === undefined ? {} : { comment: params.comment }),
    },
  });
}

export async function revokeNotification(params: {
  store: TokenStore;
  callbackurl: string;
  appli?: number;
}): Promise<void> {
  await callNotify({
    store: params.store,
    action: "revoke",
    fields: {
      callbackurl: params.callbackurl,
      ...(params.appli === undefined ? {} : { appli: String(params.appli) }),
    },
  });
}
