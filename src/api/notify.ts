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
