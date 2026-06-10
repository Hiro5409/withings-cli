import { fetchActivities, type ActivityQuery } from "./api/activity.js";
import {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  generateState,
  getTokenStatus,
  refreshAccessToken,
} from "./api/auth.js";
import type { TokenStore } from "./api/client.js";
import {
  fetchLatestMeasure,
  fetchMeasures,
  normalizeMeasureGroup,
  type MeasureQuery,
} from "./api/measures.js";
import {
  listNotifications,
  revokeNotification,
  subscribeNotification,
  type NotifySubscription,
} from "./api/notify.js";
import { callRawWithings } from "./api/raw.js";
import { fetchSleepSummaries, type SleepQuery } from "./api/sleep.js";

export {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchActivities,
  fetchLatestMeasure,
  fetchMeasures,
  fetchSleepSummaries,
  generateState,
  getTokenStatus,
  listNotifications,
  normalizeMeasureGroup,
  refreshAccessToken,
  revokeNotification,
  subscribeNotification,
};
export type { TokenSet, TokenStore } from "./api/client.js";
export type { ActivityQuery, MeasureQuery, NotifySubscription, SleepQuery };

export function createWithingsClient(params: { store: TokenStore }) {
  const { store } = params;

  return {
    fetchMeasures(args: { query: MeasureQuery }) {
      return fetchMeasures({ store, query: args.query });
    },

    fetchLatestMeasure() {
      return fetchLatestMeasure({ store });
    },

    fetchActivity(args: { query: ActivityQuery }) {
      return fetchActivities({ store, query: args.query });
    },

    fetchActivities(args: { query: ActivityQuery }) {
      return fetchActivities({ store, query: args.query });
    },

    fetchSleep(args: { query: SleepQuery }) {
      return fetchSleepSummaries({ store, query: args.query });
    },

    fetchSleepSummaries(args: { query: SleepQuery }) {
      return fetchSleepSummaries({ store, query: args.query });
    },

    raw(args: {
      service: string;
      action: string;
      fields: Record<string, unknown>;
      throwOnStatus?: boolean;
    }) {
      return callRawWithings({ store, ...args });
    },

    listNotifications(args: { appli?: number } = {}) {
      return listNotifications({ store, ...args });
    },

    subscribeNotification(args: { callbackurl: string; appli: number; comment?: string }) {
      return subscribeNotification({ store, ...args });
    },

    revokeNotification(args: { callbackurl: string; appli?: number }) {
      return revokeNotification({ store, ...args });
    },
  };
}
