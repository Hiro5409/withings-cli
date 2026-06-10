import { CliError } from "../errors.ts";
import { postWithingsForm } from "./client.ts";
import { isObject, numberOrUndefined } from "./parse.ts";
import { assertWithingsOk } from "./withings-error.ts";

const SERVICE_URLS: Record<string, string> = {
  heart: "https://wbsapi.withings.net/v2/heart",
  measure: "https://wbsapi.withings.net/measure",
  measurev2: "https://wbsapi.withings.net/v2/measure",
  notify: "https://wbsapi.withings.net/notify",
  sleepv2: "https://wbsapi.withings.net/v2/sleep",
  stetho: "https://wbsapi.withings.net/v2/stetho",
  user: "https://wbsapi.withings.net/v2/user",
};

export function parseRawJson(value: string | undefined): Record<string, unknown> {
  if (value === undefined || value.trim() === "") return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new CliError("Invalid raw JSON argument.", {
      exitCode: 3,
      code: "invalid_json",
      why: "The raw command expects a JSON object argument or stdin payload.",
      hint: 'Use syntax like: withings raw user getdevice \'{"foo":"bar"}\'.',
    });
  }

  if (!isObject(parsed) || Array.isArray(parsed)) {
    throw new CliError("Invalid raw JSON argument.", {
      exitCode: 3,
      code: "invalid_json",
      why: "The raw command payload must be a JSON object.",
      hint: 'Use an object: withings raw user getdevice \'{"foo":"bar"}\'.',
    });
  }

  return parsed;
}

function rawValueToString(value: unknown, key: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new CliError(`Invalid raw field "${key}".`, {
    exitCode: 3,
    code: "invalid_raw_field",
    why: "Withings form parameters must be strings, numbers, or booleans.",
    hint: "Flatten nested objects before passing them to the raw command.",
  });
}

export function buildRawForm(action: string, fields: Record<string, unknown>): URLSearchParams {
  const form = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(fields)) {
    if (key === "action" || value === undefined || value === null) continue;
    form.set(key, rawValueToString(value, key));
  }
  return form;
}

export function rawServiceUrl(service: string): string {
  const url = SERVICE_URLS[service];
  if (!url) {
    throw new CliError(`Unknown Withings service "${service}".`, {
      exitCode: 3,
      code: "unknown_service",
      why: "The raw command needs a known Withings service name to choose the API URL.",
      hint: `Use one of: ${Object.keys(SERVICE_URLS).join(", ")}.`,
    });
  }
  return url;
}

export async function callRawWithings(params: {
  configDir: string;
  profile: string;
  service: string;
  action: string;
  fields: Record<string, unknown>;
  throwOnStatus?: boolean;
}): Promise<unknown> {
  const response = await postWithingsForm({
    url: rawServiceUrl(params.service),
    form: buildRawForm(params.action, params.fields),
    configDir: params.configDir,
    profile: params.profile,
  });

  if (params.throwOnStatus !== false) {
    const root = isObject(response) ? response : {};
    assertWithingsOk(
      { status: numberOrUndefined(root.status), body: root.body },
      { service: params.service, action: params.action },
    );
  }

  return response;
}
