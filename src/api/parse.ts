// Tiny helpers for narrowing JSON from the Withings API at the boundary.
// Prefer these over type assertions: a wrong shape degrades to undefined
// instead of lying to the type system.

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function integerOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : undefined;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export type WithingsMore = boolean | number;

export function moreOrUndefined(value: unknown): WithingsMore | undefined {
  return typeof value === "boolean" || typeof value === "number" ? value : undefined;
}

export function hasMore(value: unknown): boolean {
  return value === true || value === 1;
}

export function parseOffset(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

export function minutesFromSeconds(value: unknown): number | undefined {
  const seconds = numberOrUndefined(value);
  return seconds === undefined ? undefined : seconds / 60;
}

export function isoFromUnixSeconds(value: unknown): string | undefined {
  const timestamp = numberOrUndefined(value);
  return timestamp === undefined ? undefined : new Date(timestamp * 1000).toISOString();
}
