import { CliError } from "../errors.js";

type WithingsResponse = {
  status?: number;
  body?: unknown;
};

type WithingsErrorContext = {
  service: string;
  action: string;
};

type WithingsErrorCode =
  | "auth_failed"
  | "invalid_params"
  | "unauthorized"
  | "rate_limited"
  | "temporary_failure"
  | "unknown";

function contextKey(context: WithingsErrorContext, status: number): string {
  return `${context.service}.${context.action}:${status}`;
}

function endpointName(context: WithingsErrorContext): string {
  return `${context.service}.${context.action}`;
}

function classifyStatus(status: number): WithingsErrorCode {
  if ([100, 101, 102, 200, 401].includes(status)) return "auth_failed";
  if ([214, 277, 2553, 2554, 2555].includes(status)) return "unauthorized";
  if (status === 601) return "rate_limited";
  if ([522, 524].includes(status)) return "temporary_failure";
  if (
    [
      201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 216, 217, 218, 220, 221, 223,
      225, 227, 228, 229, 230, 234, 235, 236, 238, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249,
      250, 251, 252, 254, 260, 261, 262, 263, 264, 265, 266, 267, 271, 272, 275, 276, 283, 284, 285,
      286, 287, 288, 290, 293, 294, 295, 297, 300, 301, 302, 303, 304, 321, 323, 324, 325, 326, 327,
      328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346,
      347, 348, 349, 350, 351, 352, 353, 380, 381, 382, 400, 501, 502, 503, 504, 505, 506, 509, 510,
      511, 523, 532, 3017, 3018, 3019,
    ].includes(status)
  ) {
    return "invalid_params";
  }
  return "unknown";
}

const KNOWN_HINTS: Record<string, string> = {
  "user.get:503":
    "user.get is restricted to account-creation integrations such as Withings Cellular Solutions or Mobile SDK. For this OAuth app, use user.getdevice or user.getgoals.",
  "measure.getmeas:503":
    "Check request parameters and form encoding: action=getmeas, category, meastypes, startdate, enddate, lastupdate, and offset.",
};

export class WithingsApiError extends CliError {
  readonly status: number;
  readonly withingsStatus: number;
  readonly service: string;
  readonly action: string;
  readonly endpoint: string;
  readonly body?: unknown;

  constructor(status: number, context: WithingsErrorContext, body?: unknown) {
    const endpoint = endpointName(context);
    super(`Withings API returned status ${status} for ${context.service}.${context.action}.`, {
      exitCode: 4,
      code: classifyStatus(status),
      details: {
        withingsStatus: status,
        endpoint,
      },
      why: "The HTTP request succeeded, but Withings rejected the API operation.",
      hint:
        KNOWN_HINTS[contextKey(context, status)] ??
        "Check the endpoint permissions, requested OAuth scopes, and request parameters. Use the raw command to inspect the full Withings response.",
    });
    this.name = "WithingsApiError";
    this.status = status;
    this.withingsStatus = status;
    this.service = context.service;
    this.action = context.action;
    this.endpoint = endpoint;
    this.body = body;
  }
}

export function assertWithingsOk(response: WithingsResponse, context: WithingsErrorContext): void {
  if (response.status === 0 || response.status === undefined) return;
  throw new WithingsApiError(response.status, context, response.body);
}
