import { define } from "gunshi";
import colors from "yoctocolors";
import {
  KNOWN_APPLI,
  listNotifications,
  revokeNotification,
  subscribeNotification,
} from "../api/notify.js";
import { CliError } from "../errors.js";
import { globalArgs } from "../global-args.js";
import { outputFormat, printJson, printMessage, printRows } from "../output.js";
import { tokenStoreForProfile } from "./token-store.js";

function parseAppli(value: unknown, required: boolean): number | undefined {
  if (value === undefined) {
    if (!required) return undefined;
    throw new CliError(`--appli is required (${KNOWN_APPLI}).`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CliError(`--appli must be a non-negative integer (${KNOWN_APPLI}).`);
  }
  return parsed;
}

function requireCallbackUrl(value: unknown): string {
  const url = typeof value === "string" ? value : "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new CliError("--callbackurl must be an http(s) URL reachable by Withings servers.");
  }
  return url;
}

const listCommand = define({
  name: "list",
  description: "List webhook subscriptions",
  args: {
    ...globalArgs,
    appli: {
      type: "string" as const,
      description: `Filter by notification category (${KNOWN_APPLI})`,
    },
  },
  run: async (ctx) => {
    const profile = String(ctx.values.profile ?? "default");
    const subscriptions = await listNotifications({
      store: tokenStoreForProfile(profile),
      appli: parseAppli(ctx.values.appli, false),
    });

    if (outputFormat(ctx.values.format) === "json") {
      printJson({ subscriptions });
      return;
    }

    printRows(
      subscriptions.map((subscription) => ({
        appli: subscription.appli,
        callbackurl: subscription.callbackurl,
        comment: subscription.comment,
        expires:
          subscription.expires === undefined
            ? undefined
            : new Date(subscription.expires * 1000).toISOString(),
      })),
    );
  },
});

const subscribeCommand = define({
  name: "subscribe",
  description: "Subscribe a callback URL to Withings data notifications",
  args: {
    ...globalArgs,
    callbackurl: {
      type: "string" as const,
      description: "Publicly reachable http(s) URL that Withings will POST to",
    },
    appli: {
      type: "string" as const,
      description: `Notification category (${KNOWN_APPLI})`,
    },
    comment: {
      type: "string" as const,
      description: "Free-text label for this subscription",
    },
  },
  run: async (ctx) => {
    const profile = String(ctx.values.profile ?? "default");
    const callbackurl = requireCallbackUrl(ctx.values.callbackurl);
    const appli = parseAppli(ctx.values.appli, true);
    if (appli === undefined) throw new CliError("--appli is required.");

    await subscribeNotification({
      store: tokenStoreForProfile(profile),
      callbackurl,
      appli,
      comment: typeof ctx.values.comment === "string" ? ctx.values.comment : undefined,
    });

    printMessage(
      colors.green(`Subscribed ${callbackurl} to appli ${appli}.`),
      outputFormat(ctx.values.format),
      { ok: true, callbackurl, appli },
    );
  },
});

const revokeCommand = define({
  name: "revoke",
  description: "Revoke a webhook subscription",
  args: {
    ...globalArgs,
    callbackurl: {
      type: "string" as const,
      description: "Callback URL of the subscription to revoke",
    },
    appli: {
      type: "string" as const,
      description: `Limit revocation to one category (${KNOWN_APPLI})`,
    },
  },
  run: async (ctx) => {
    const profile = String(ctx.values.profile ?? "default");
    const callbackurl = requireCallbackUrl(ctx.values.callbackurl);
    const appli = parseAppli(ctx.values.appli, false);

    await revokeNotification({
      store: tokenStoreForProfile(profile),
      callbackurl,
      appli,
    });

    printMessage(
      colors.green(`Revoked subscription for ${callbackurl}.`),
      outputFormat(ctx.values.format),
      { ok: true, callbackurl, appli },
    );
  },
});

export const notifyCommand = define({
  name: "notify",
  description: "Manage Withings webhook notifications",
  args: globalArgs,
  run: () => {
    console.log('Run "withings notify --help" for usage information.');
  },
  subCommands: {
    list: listCommand,
    subscribe: subscribeCommand,
    revoke: revokeCommand,
  },
});
