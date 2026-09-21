import { define } from "gunshi";
import { args, combinator, integer, merge, required } from "gunshi/combinators";
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
import { nonEmptyStringArg } from "../value-arg.js";
import { tokenStoreForProfile } from "./token-store.js";

const callbackUrl = combinator({
  description: "Publicly reachable http(s) callback URL",
  parse: (url) => {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new CliError("--callbackurl must be an http(s) URL reachable by Withings servers.");
    }
    return url;
  },
});

const appli = integer({
  min: 0,
  description: `Notification category (${KNOWN_APPLI})`,
});

const listCommand = define({
  name: "list",
  description: "List webhook subscriptions",
  args: merge(globalArgs, args({ appli })),
  run: async (ctx) => {
    const subscriptions = await listNotifications({
      store: tokenStoreForProfile(ctx.values.profile),
      appli: ctx.values.appli,
    });

    if (ctx.values.format === "json") {
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
  args: merge(
    globalArgs,
    args({
      callbackurl: required(callbackUrl),
      appli: required(appli),
      comment: nonEmptyStringArg("comment", "Free-text label for this subscription"),
    }),
  ),
  run: async (ctx) => {
    await subscribeNotification({
      store: tokenStoreForProfile(ctx.values.profile),
      callbackurl: ctx.values.callbackurl,
      appli: ctx.values.appli,
      comment: ctx.values.comment,
    });

    printMessage(
      colors.green(`Subscribed ${ctx.values.callbackurl} to appli ${ctx.values.appli}.`),
      outputFormat(ctx.values.format),
      { ok: true, callbackurl: ctx.values.callbackurl, appli: ctx.values.appli },
    );
  },
});

const revokeCommand = define({
  name: "revoke",
  description: "Revoke a webhook subscription",
  args: merge(globalArgs, args({ callbackurl: required(callbackUrl), appli })),
  run: async (ctx) => {
    await revokeNotification({
      store: tokenStoreForProfile(ctx.values.profile),
      callbackurl: ctx.values.callbackurl,
      appli: ctx.values.appli,
    });

    printMessage(
      colors.green(`Revoked subscription for ${ctx.values.callbackurl}.`),
      outputFormat(ctx.values.format),
      { ok: true, callbackurl: ctx.values.callbackurl, appli: ctx.values.appli },
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
